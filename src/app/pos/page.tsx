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
  Coins
} from 'lucide-react';

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

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customer checkout state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderSource, setOrderSource] = useState<'UBER_EATS' | 'RAPPI' | 'WEB' | 'PHONE'>('WEB');
  const [tip, setTip] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState('');
  
  // Modal states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const { cart, addToCart, removeFromCart, updateCartQty, updateCartNotes, clearCart, addNotification } = useAppStore();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to fetch POS products', err);
    }
  };

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

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartTax = parseFloat((cartSubtotal * 0.16).toFixed(2));
  const cartTotal = parseFloat((cartSubtotal + cartTax + tip).toFixed(2));

  const handlePlaceOrder = async () => {
    if (!customerName) {
      alert('Por favor introduce el nombre del cliente');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAddress,
          source: orderSource,
          notes: orderNotes,
          tip,
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
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setTip(0);
        setOrderNotes('');
        // Refresh products list to update local ingredients stock
        fetchProducts();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (e) {
      alert('Error de red al colocar pedido');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
              <span className="font-bold text-white">Total</span>
              <span className="font-black text-brand-primary">${cartTotal.toFixed(2)}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              ✕
            </button>
            <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
              <Coins className="h-5 w-5 text-brand-primary" />
              <h3 className="text-lg font-bold text-white">Detalles del Pedido Delivery</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Origen de Venta</label>
                  <select
                    value={orderSource}
                    onChange={(e: any) => setOrderSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  >
                    <option value="WEB">Sitio Web Propio</option>
                    <option value="PHONE">Teléfono / WhatsApp</option>
                    <option value="UBER_EATS">Uber Eats App</option>
                    <option value="RAPPI">Rappi App</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Pérez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Teléfono</label>
                <input
                  type="text"
                  placeholder="555-0129"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Dirección de Entrega</label>
                <textarea
                  placeholder="Calle Reforma #102, Col. Centro"
                  rows={2}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Notas Adicionales del Reparto</label>
                <input
                  type="text"
                  placeholder="Tocar el timbre verde, apto 4B"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={loading}
                className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
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
                <p><strong>Origen:</strong> {placedOrder.source}</p>
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
                  {placedOrder.items.map((item: any) => (
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

            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="h-4 w-4" /> Imprimir Comanda
              </button>
              <button
                onClick={() => setPlacedOrder(null)}
                className="flex-1 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-sm rounded-lg cursor-pointer"
              >
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardContainer>
  );
}
