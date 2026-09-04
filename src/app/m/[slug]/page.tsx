'use client';

import React, { useEffect, useState, useMemo, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  X, 
  Sparkles, 
  Tag, 
  Utensils, 
  ArrowRight,
  AlertCircle,
  ChevronRight,
  User,
  Phone,
  MessageSquare
} from 'lucide-react';

interface PublicIngredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
}

interface PublicRecipeItem {
  ingredient: PublicIngredient;
}

interface PublicProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId: string;
  recipeItems: PublicRecipeItem[];
}

interface PublicCategory {
  id: string;
  name: string;
  products: PublicProduct[];
}

interface PublicComboItem {
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
  };
}

interface PublicCombo {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  originalPrice: number;
  savings: number;
  savingsPercent: number;
  items: PublicComboItem[];
}

interface PublicTable {
  id: string;
  number: string;
  name: string;
  zone: string;
  status: string;
}

interface PublicBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
}

interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  notes?: string;
}

export default function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryTable = searchParams.get('table') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<PublicBrand | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [combos, setCombos] = useState<PublicCombo[]>([]);
  const [tables, setTables] = useState<PublicTable[]>([]);

  // Filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Selected item modal for customization
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState('');

  // Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>(queryTable ? 'DINE_IN' : 'DINE_IN');
  const [selectedTableNumber, setSelectedTableNumber] = useState(queryTable);
  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load menu data
  useEffect(() => {
    async function fetchMenu() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/menu/${slug}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'No se pudo cargar el menú');
        }
        const data = await res.json();
        setBrand(data.brand);
        setCategories(data.categories || []);
        setCombos(data.combos || []);
        setTables(data.tables || []);
        if (queryTable) {
          setSelectedTableNumber(queryTable);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al conectar con la cocina');
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [slug, queryTable]);

  // Add regular product to cart
  const handleAddToCart = (product: PublicProduct, qty = 1, notes = '') => {
    const existingIndex = cart.findIndex(
      (c) => c.productId === product.id && (c.notes || '') === (notes || '')
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += qty;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          cartId: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: qty,
          imageUrl: product.imageUrl,
          notes: notes.trim() || undefined,
        },
      ]);
    }

    setSelectedProduct(null);
    setModalQty(1);
    setModalNotes('');
  };

  // Add combo items to cart prorated
  const handleAddComboToCart = (combo: PublicCombo) => {
    const ratio = combo.originalPrice > 0 ? combo.price / combo.originalPrice : 1;
    let runningSum = 0;

    const newItems: CartItem[] = [];
    combo.items.forEach((item, index) => {
      const isLast = index === combo.items.length - 1;
      let unitPrice = parseFloat((item.product.price * ratio).toFixed(2));
      if (isLast) {
        const currentTotal = runningSum + unitPrice * item.quantity;
        const diff = parseFloat((combo.price - currentTotal).toFixed(2));
        unitPrice = parseFloat((unitPrice + diff / item.quantity).toFixed(2));
      }
      runningSum += unitPrice * item.quantity;

      newItems.push({
        cartId: `${item.product.id}-${Date.now()}-${index}`,
        productId: item.product.id,
        name: `${item.product.name} (Combo ${combo.name})`,
        price: unitPrice,
        quantity: item.quantity,
        imageUrl: item.product.imageUrl,
        notes: `Parte del combo ${combo.name}`,
      });
    });

    setCart([...cart, ...newItems]);
  };

  const updateCartItemQty = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Calculations
  const cartSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart]
  );
  const cartTax = parseFloat((cartSubtotal * 0.16).toFixed(2));
  const cartTotal = parseFloat((cartSubtotal + cartTax).toFixed(2));
  const totalItemsCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  // Submit Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Por favor indica tu nombre para que podamos entregarte el pedido.');
      return;
    }

    if (orderType === 'DINE_IN' && !selectedTableNumber) {
      alert('Por favor selecciona el número de mesa en la que te encuentras.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandSlug: slug,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          orderType,
          tableNumber: orderType === 'DINE_IN' ? selectedTableNumber : undefined,
          notes: orderNotes.trim() || undefined,
          couponCode: couponCode.trim() || undefined,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el pedido');
      }

      // Order created! Clear cart and redirect to live tracking screen
      setCart([]);
      setIsCartOpen(false);
      router.push(`/order-tracking/${data.order.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al enviar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products by category and search
  const filteredCategories = useMemo(() => {
    return categories
      .map((cat) => {
        const matchesCat = selectedCategory === 'all' || selectedCategory === cat.id;
        if (!matchesCat) return null;

        const filteredProds = cat.products.filter((p) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
        });

        if (filteredProds.length === 0) return null;
        return {
          ...cat,
          products: filteredProds,
        };
      })
      .filter(Boolean) as PublicCategory[];
  }, [categories, selectedCategory, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm animate-pulse">Cargando menú digital...</p>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold">Cocina no disponible</h1>
        <p className="text-sm text-slate-400 max-w-xs">{error || 'La marca solicitada no está disponible en este momento.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24 selection:bg-amber-500 selection:text-slate-950">
      {/* Brand Header Banner */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {brand.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow"
                style={{ backgroundColor: brand.primaryColor }}
              >
                {brand.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-bold text-white text-base leading-tight flex items-center gap-1.5">
                {brand.name}
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Abierto" />
              </h1>
              <p className="text-[11px] text-slate-400">Carta Digital & Auto-Pedido</p>
            </div>
          </div>

          {/* Table Badge */}
          {selectedTableNumber ? (
            <div className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs text-amber-400 font-bold shadow-sm">
              <Utensils className="w-3.5 h-3.5" />
              <span>Mesa {selectedTableNumber}</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">Auto-servicio</span>
          )}
        </div>

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto px-4 pb-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar platillo, combo o bebida..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="max-w-3xl mx-auto px-4 overflow-x-auto pb-2 scrollbar-none flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todos
          </button>
          {combos.length > 0 && (
            <button
              onClick={() => setSelectedCategory('combos')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                selectedCategory === 'combos'
                  ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                  : 'bg-slate-800/80 text-amber-400 border border-amber-500/30 hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Combos ({combos.length})
            </button>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Menu Content */}
      <main className="max-w-3xl mx-auto w-full px-4 pt-4 space-y-6">
        {/* Combos Showcase */}
        {(selectedCategory === 'all' || selectedCategory === 'combos') && combos.length > 0 && !searchQuery && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Combos & Paquetes del Chef
              </h2>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                Ahorro Especial
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg hover:border-amber-500/60 transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                        {combo.name}
                      </h3>
                      {combo.savingsPercent > 0 && (
                        <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md shrink-0 shadow">
                          -{combo.savingsPercent}%
                        </span>
                      )}
                    </div>
                    {combo.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{combo.description}</p>
                    )}
                    <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Incluye:</span>
                      {combo.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>• {i.quantity}x {i.product.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <div>
                      {combo.originalPrice > combo.price && (
                        <span className="text-[11px] text-slate-500 line-through mr-2 font-mono">
                          ${combo.originalPrice.toFixed(2)}
                        </span>
                      )}
                      <span className="text-base font-black text-amber-400 font-mono">
                        ${combo.price.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleAddComboToCart(combo)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-md cursor-pointer transition-transform active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Regular Products by Category */}
        {selectedCategory !== 'combos' && (
          <div className="space-y-6">
            {filteredCategories.map((category) => (
              <section key={category.id} className="space-y-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  {category.name}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {category.products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        setModalQty(1);
                        setModalNotes('');
                      }}
                      className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3 flex gap-3 cursor-pointer transition-all hover:bg-slate-850 shadow group"
                    >
                      {product.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-24 h-24 rounded-xl object-cover shrink-0 border border-slate-800 group-hover:scale-103 transition-transform"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-600 shrink-0">
                          <Utensils className="w-8 h-8" />
                        </div>
                      )}

                      <div className="flex-1 flex flex-col justify-between py-0.5">
                        <div>
                          <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="font-mono font-black text-white text-sm">
                            ${product.price.toFixed(2)}
                          </span>

                          <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                            <Plus className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">
                No se encontraron platillos con el término &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Customization / Add Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedProduct.name}</h3>
                <span className="font-mono font-bold text-amber-400 text-base">
                  ${selectedProduct.price.toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedProduct.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-full h-44 object-cover rounded-xl border border-slate-800"
              />
            )}

            {selectedProduct.description && (
              <p className="text-xs text-slate-300">{selectedProduct.description}</p>
            )}

            {/* Special notes */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                Instrucciones para la cocina (Opcional):
              </label>
              <input
                type="text"
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="Ej. Sin cebolla, término medio, aderezo aparte..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quantity and Add Button */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-sm text-white font-mono">
                  {modalQty}
                </span>
                <button
                  type="button"
                  onClick={() => setModalQty(modalQty + 1)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleAddToCart(selectedProduct, modalQty, modalNotes)}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer text-sm"
              >
                <span>Agregar al Pedido</span>
                <span className="font-mono">
                  ${(selectedProduct.price * modalQty).toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black p-3.5 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer transition-all active:scale-98 group"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-slate-950 text-amber-400 text-xs px-2.5 py-1 rounded-lg font-mono">
                {totalItemsCount}
              </span>
              <span className="text-sm">Ver Mi Pedido</span>
            </div>

            <div className="flex items-center gap-1.5 text-sm font-mono">
              <span>${cartTotal.toFixed(2)}</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* Checkout Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Confirmar Mi Pedido</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List & Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Items List */}
              <div className="space-y-2 divide-y divide-slate-800/80">
                {cart.map((item) => (
                  <div key={item.cartId} className="pt-2 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-white text-xs leading-tight">{item.name}</p>
                      {item.notes && <p className="text-[11px] text-amber-400/80 italic mt-0.5">&ldquo;{item.notes}&rdquo;</p>}
                      <span className="text-xs text-slate-400 font-mono">${item.price.toFixed(2)} c/u</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.cartId, -1)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.cartId, 1)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="w-16 text-right font-mono font-bold text-white text-xs">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Service Type Selection */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">Tipo de Servicio:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType('DINE_IN')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      orderType === 'DINE_IN'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" /> En Mesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('TAKEAWAY')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      orderType === 'TAKEAWAY'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Para Llevar
                  </button>
                </div>

                {orderType === 'DINE_IN' && (
                  <div className="pt-2">
                    <label className="text-[11px] text-slate-400 block mb-1">Mesa en la que te encuentras:</label>
                    {tables.length > 0 ? (
                      <select
                        value={selectedTableNumber}
                        onChange={(e) => setSelectedTableNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- Selecciona tu mesa --</option>
                        {tables.map((t) => (
                          <option key={t.id} value={t.number}>
                            Mesa {t.number} ({t.zone})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedTableNumber}
                        onChange={(e) => setSelectedTableNumber(e.target.value)}
                        placeholder="Número de mesa (Ej. 1, 4, Terraza 2)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Diner Details */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Tu Nombre <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej. Carlos Mendoza"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Teléfono celular (Opcional - Ganas Puntos de Fidelidad)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ej. 5512345678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Cupón de Descuento (Opcional)
                  </label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Ej. BIENVENIDO10"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Notas adicionales para el pedido
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ej. Traer cubiertos extra, cuenta junta..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Financial Totals */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>IVA (16%):</span>
                  <span className="font-mono">${cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800 text-sm">
                  <span>Total Estimado:</span>
                  <span className="text-amber-400 font-mono">${cartTotal.toFixed(2)} MXN</span>
                </div>
              </div>
            </div>

            {/* Footer Action Button */}
            <div className="p-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50 transition-all text-sm active:scale-98"
              >
                {submitting ? (
                  <span>Enviando a cocina...</span>
                ) : (
                  <>
                    <span>Confirmar y Enviar a Cocina</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
