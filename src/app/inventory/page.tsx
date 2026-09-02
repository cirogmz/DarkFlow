'use client';

import React, { useEffect, useState } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  Plus, 
  AlertTriangle, 
  TrendingUp, 
  History, 
  Settings, 
  Package, 
  Utensils, 
  ShoppingCart,
  CheckCircle2
} from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
  cost: number;
  minStock: number;
}

interface Purchase {
  id: string;
  quantity: number;
  cost: number;
  supplier?: string | null;
  purchaseDate: string;
  ingredient: {
    name: string;
    unit: string;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  recipeItems: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
  }>;
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [activeTab, setActiveTab] = useState<'ingredients' | 'purchases' | 'recipes'>('ingredients');
  const [loading, setLoading] = useState(true);

  // New Ingredient state
  const [newIngName, setNewIngName] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('pzs');
  const [newIngStock, setNewIngStock] = useState<number>(0);
  const [newIngMinStock, setNewIngMinStock] = useState<number>(5);
  const [newIngCost, setNewIngCost] = useState<number>(0);
  const [showAddIngModal, setShowAddIngModal] = useState(false);

  // New Purchase state
  const [selectedIngId, setSelectedIngId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState<number>(0);
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Recipe mapping state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [mapIngId, setMapIngId] = useState('');
  const [mapQty, setMapQty] = useState<number>(0);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      // Fetch ingredients and purchases
      const invRes = await fetch('/api/inventory');
      if (invRes.ok) {
        const invData = await invRes.json();
        setIngredients(invData.ingredients);
        setPurchases(invData.purchases);
      }

      // Fetch products for recipe builder
      const prodRes = await fetch('/api/products');
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products);
        if (prodData.products.length > 0 && !selectedProductId) {
          setSelectedProductId(prodData.products[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch inventory data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName || !newIngUnit) return;

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'new_ingredient',
          name: newIngName,
          unit: newIngUnit,
          stock: newIngStock,
          minStock: newIngMinStock,
          cost: newIngCost,
        }),
      });

      if (res.ok) {
        setShowAddIngModal(false);
        setNewIngName('');
        setNewIngStock(0);
        setNewIngCost(0);
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Error al agregar insumo');
    }
  };

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngId || purchaseQty <= 0 || purchaseCost <= 0) return;

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          ingredientId: selectedIngId,
          quantity: purchaseQty,
          cost: purchaseCost,
          supplier: purchaseSupplier,
        }),
      });

      if (res.ok) {
        setShowPurchaseModal(false);
        setPurchaseQty(0);
        setPurchaseCost(0);
        setPurchaseSupplier('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Error al registrar compra');
    }
  };

  const handleSaveRecipeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !mapIngId) return;

    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          ingredientId: mapIngId,
          quantity: mapQty,
        }),
      });

      if (res.ok) {
        setMapIngId('');
        setMapQty(0);
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Error al actualizar ficha técnica');
    }
  };

  // Calculations
  const lowStockCount = ingredients.filter(i => i.stock < i.minStock).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + (i.stock * i.cost), 0);

  const activeProduct = products.find(p => p.id === selectedProductId);

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* KPI Widgets for Inventory */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Insumos Registrados</p>
              <h3 className="text-2xl font-black text-white mt-1">{ingredients.length}</h3>
              <p className="text-xs text-slate-500 mt-1">Materias primas en cocina</p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <Package className="h-6 w-6" />
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Insumos en Stock Bajo</p>
              <h3 className="text-2xl font-black text-white mt-1">{lowStockCount}</h3>
              {lowStockCount > 0 ? (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1 font-medium animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" /> Requiere reabastecimiento
                </p>
              ) : (
                <p className="text-xs text-emerald-500 mt-1">Stock saludable</p>
              )}
            </div>
            <div className={`p-3 rounded-xl border ${lowStockCount > 0 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Valor del Inventario</p>
              <h3 className="text-2xl font-black text-white mt-1">${totalValuation.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-500 mt-1">Costo promedio total en almacén</p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-6 text-sm shrink-0">
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'ingredients' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Insumos / Almacén
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'purchases' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Registro de Compras
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'recipes' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Fichas Técnicas (Recetas)
          </button>
        </div>

        {/* Tab 1: INGREDIENTS LIST */}
        {activeTab === 'ingredients' && (
          <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
              <div>
                <h4 className="font-bold text-white text-base">Almacén de Ingredientes</h4>
                <p className="text-xs text-slate-500 mt-1">Lista detallada de insumos, costos promedio y stock actual de la marca.</p>
              </div>
              <button
                onClick={() => setShowAddIngModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[3px]" /> Nuevo Insumo
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <th className="p-4">Ingrediente</th>
                    <th className="p-4">Costo Promedio</th>
                    <th className="p-4">Stock Mínimo</th>
                    <th className="p-4">Stock Actual</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ingredients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">No hay insumos registrados en esta cocina.</td>
                    </tr>
                  ) : (
                    ingredients.map((ing) => {
                      const isLow = ing.stock < ing.minStock;
                      return (
                        <tr key={ing.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 font-bold text-white">{ing.name}</td>
                          <td className="p-4 text-slate-300">${ing.cost.toFixed(2)} / {ing.unit}</td>
                          <td className="p-4 text-slate-400">{ing.minStock} {ing.unit}</td>
                          <td className={`p-4 font-black ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                            {ing.stock.toFixed(2)} {ing.unit}
                          </td>
                          <td className="p-4">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-900/50 px-2 py-0.5 rounded">
                                <AlertTriangle className="h-3 w-3" /> Bajo Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded">
                                <CheckCircle2 className="h-3 w-3" /> Óptimo
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-200">
                            ${(ing.stock * ing.cost).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: PURCHASES REGISTRATION */}
        {activeTab === 'purchases' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Purchase Form Card */}
            <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-brand-primary" />
                <h4 className="font-bold text-white">Registrar Entrada</h4>
              </div>

              <form onSubmit={handleRegisterPurchase} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Seleccionar Insumo *</label>
                  <select
                    required
                    value={selectedIngId}
                    onChange={(e) => setSelectedIngId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  >
                    <option value="">-- Elige un ingrediente --</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Cantidad Recibida *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="50"
                      value={purchaseQty || ''}
                      onChange={(e) => setPurchaseQty(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Costo Total ($) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="150"
                      value={purchaseCost || ''}
                      onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Proveedor</label>
                  <input
                    type="text"
                    placeholder="Distribuidora Carnes SA"
                    value={purchaseSupplier}
                    onChange={(e) => setPurchaseSupplier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer"
                >
                  Guardar Compra
                </button>
              </form>
            </div>

            {/* Purchase History list */}
            <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <History className="h-5 w-5 text-slate-400" />
                <h4 className="font-bold text-white">Historial de Entradas de Mercancía</h4>
              </div>

              <div className="overflow-y-auto max-h-[350px] pr-1 space-y-3">
                {purchases.length === 0 ? (
                  <div className="text-center text-slate-600 text-xs py-8">No hay registros de compras recientes</div>
                ) : (
                  purchases.map((pur) => (
                    <div key={pur.id} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                      <div>
                        <span className="font-bold text-white">{pur.ingredient.name}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Recibido de: {pur.supplier || 'N/A'} • {new Date(pur.purchaseDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-brand-primary">+{pur.quantity} {pur.ingredient.unit}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Total: ${pur.cost.toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: RECIPES & SHEETS BUILDER */}
        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Product Selector List */}
            <div className="glass-panel border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col overflow-hidden max-h-[450px]">
              <div className="border-b border-slate-800 pb-2 mb-3 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-slate-400" />
                <h4 className="font-bold text-white text-sm">Selecciona un Platillo</h4>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {products.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => setSelectedProductId(prod.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs font-semibold transition-all flex justify-between items-center ${
                      selectedProductId === prod.id
                        ? 'bg-brand-primary text-slate-950 font-bold'
                        : 'bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[180px]">{prod.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                      selectedProductId === prod.id ? 'bg-slate-950 text-brand-primary' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {prod.recipeItems.length} insumos
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Recipe Editor details */}
            <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-5 flex flex-col justify-between">
              {activeProduct ? (
                <>
                  <div className="space-y-4">
                    <div className="border-b border-slate-800 pb-3">
                      <h4 className="font-bold text-white text-base">Ficha Técnica: {activeProduct.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">Define las cantidades exactas de materias primas que explotan por cada porción vendida.</p>
                    </div>

                    {/* Active ingredients in product recipe */}
                    <div className="space-y-2">
                      <h5 className="font-bold text-slate-300 text-xs">Ingredientes en la Receta:</h5>
                      {ingredients.filter(ing => 
                        activeProduct.recipeItems.some(ri => ri.ingredientId === ing.id)
                      ).length === 0 ? (
                        <div className="p-4 text-center border border-slate-800 border-dashed rounded text-slate-500 text-xs">
                          Este producto no tiene ingredientes mapeados. Añade uno abajo.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activeProduct.recipeItems.map((ri) => {
                            const ing = ingredients.find(i => i.id === ri.ingredientId);
                            if (!ing) return null;
                            return (
                              <div key={ri.id} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                                <div>
                                  <span className="font-bold text-white">{ing.name}</span>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Uso: {ri.quantity} {ing.unit}</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    // Remove recipe item (qty = 0)
                                    const res = await fetch('/api/inventory', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ productId: selectedProductId, ingredientId: ing.id, quantity: 0 }),
                                    });
                                    if (res.ok) fetchInventoryData();
                                  }}
                                  className="text-red-500 hover:text-red-400 font-bold px-2 py-1 hover:bg-red-950/20 rounded border border-transparent hover:border-red-900/50"
                                >
                                  Eliminar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Ingredient to Recipe Form */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <h5 className="font-bold text-slate-300 text-xs">Vincular Ingrediente</h5>
                    <form onSubmit={handleSaveRecipeItem} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-400">Materia Prima</label>
                        <select
                          required
                          value={mapIngId}
                          onChange={(e) => setMapIngId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 outline-none focus:border-brand-primary"
                        >
                          <option value="">-- Seleccionar --</option>
                          {ingredients
                            .filter(ing => !activeProduct.recipeItems.some(ri => ri.ingredientId === ing.id))
                            .map(ing => (
                              <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                            ))
                          }
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-400">Cantidad Utilizada</label>
                        <input
                          type="number"
                          required
                          step="0.001"
                          placeholder="e.g. 0.2"
                          value={mapQty || ''}
                          onChange={(e) => setMapQty(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 outline-none focus:border-brand-primary"
                        />
                      </div>

                      <button
                        type="submit"
                        className="py-2 px-4 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg cursor-pointer"
                      >
                        Añadir Insumo
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 py-12">Selecciona un producto a la izquierda</div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Add New Ingredient */}
        {showAddIngModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button 
                onClick={() => setShowAddIngModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>
              <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-white">Agregar Nuevo Insumo</h3>
              </div>

              <form onSubmit={handleAddIngredient} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre de Insumo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Queso de Bola"
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Unidad de Medida *</label>
                    <select
                      value={newIngUnit}
                      onChange={(e) => setNewIngUnit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    >
                      <option value="pzs">Piezas (pzs)</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="g">Gramos (g)</option>
                      <option value="L">Litros (L)</option>
                      <option value="ml">Mililitros (ml)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Stock Mínimo Alerta *</label>
                    <input
                      type="number"
                      required
                      value={newIngMinStock || ''}
                      onChange={(e) => setNewIngMinStock(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Stock Inicial</label>
                    <input
                      type="number"
                      value={newIngStock || ''}
                      onChange={(e) => setNewIngStock(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Costo Inicial ($)</label>
                    <input
                      type="number"
                      value={newIngCost || ''}
                      onChange={(e) => setNewIngCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddIngModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer"
                  >
                    Registrar
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
