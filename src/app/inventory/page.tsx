'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  Plus, 
  AlertTriangle, 
  TrendingUp, 
  Package, 
  Utensils, 
  ShoppingCart,
  CheckCircle2,
  ArrowRightLeft,
  Trash2,
  Warehouse as WarehouseIcon,
  ChefHat,
  Flame,
  X,
  Edit3,
  Scale,
  FileText,
  Boxes
} from 'lucide-react';
import FoodCostAuditTab from '@/components/inventory/FoodCostAuditTab';
import RequisitionsTab from '@/components/inventory/RequisitionsTab';
import PurchaseOrdersTab from '@/components/inventory/PurchaseOrdersTab';
import { BatchTrackingTab } from '@/components/inventory/BatchTrackingTab';
import DailyPrepStationView from '@/components/kitchen/DailyPrepStationView';
import WasteManagementHubTab from '@/components/inventory/WasteManagementHubTab';

interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
  cost: number;
  minStock: number;
  parLevel?: number | null;
  reorderPoint?: number | null;
  allergens?: string | null;
  type?: 'RAW' | 'PREPARED';
  yieldQuantity?: number | null;
  yieldUnit?: string | null;
  parentSubRecipes?: Array<{
    id: string;
    childIngredientId: string;
    quantity: number;
    childIngredient: {
      id: string;
      name: string;
      unit: string;
      cost: number;
      stock: number;
    };
  }>;
  warehouseStocks?: Array<{
    id: string;
    warehouseId: string;
    stock: number;
    warehouse: {
      id: string;
      name: string;
      code?: string | null;
    };
  }>;
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

interface WarehouseItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isDefault: boolean;
  stocks?: Array<{
    id: string;
    ingredientId: string;
    stock: number;
    ingredient: {
      id: string;
      name: string;
      unit: string;
    };
  }>;
}

interface ProductionBatchItem {
  id: string;
  quantity: number;
  totalCost: number;
  unitCost: number;
  notes?: string | null;
  createdAt: string;
  ingredient: {
    name: string;
    unit: string;
  };
  user?: {
    name: string;
  } | null;
}

interface WasteLogItem {
  id: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  reason: string;
  notes?: string | null;
  createdAt: string;
  ingredient: {
    name: string;
    unit: string;
  };
  warehouse?: {
    name: string;
  } | null;
  user?: {
    name: string;
  } | null;
}

interface TransferItem {
  id: string;
  quantity: number;
  notes?: string | null;
  createdAt: string;
  ingredient: {
    name: string;
    unit: string;
  };
  fromWarehouse: {
    name: string;
  };
  toWarehouse: {
    name: string;
  };
  user?: {
    name: string;
  } | null;
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatchItem[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLogItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [wasteSummary, setWasteSummary] = useState<{
    totalWasteCost: number;
    totalEvents: number;
    reasonBreakdown: Record<string, { count: number; cost: number }>;
  }>({ totalWasteCost: 0, totalEvents: 0, reasonBreakdown: {} });

  const [activeTab, setActiveTab] = useState<'ingredients' | 'batches' | 'subrecipes' | 'waste' | 'warehouses' | 'purchases' | 'recipes' | 'audit' | 'requisitions' | 'prep'>('ingredients');
  const [ingredientFilter, setIngredientFilter] = useState<'ALL' | 'RAW' | 'PREPARED'>('ALL');
  const [loading, setLoading] = useState(true);

  // New Ingredient state
  const [newIngName, setNewIngName] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngStock, setNewIngStock] = useState<number>(0);
  const [newIngMinStock, setNewIngMinStock] = useState<number>(5);
  const [newIngParLevel, setNewIngParLevel] = useState<number>(10);
  const [newIngReorderPoint, setNewIngReorderPoint] = useState<number>(5);
  const [newIngCost, setNewIngCost] = useState<number>(0);
  const [newIngType, setNewIngType] = useState<'RAW' | 'PREPARED'>('RAW');
  const [newIngAllergens, setNewIngAllergens] = useState('');
  const [showAddIngModal, setShowAddIngModal] = useState(false);

  // Adjust stock state
  const [adjustIng, setAdjustIng] = useState<Ingredient | null>(null);
  const [adjustNewStock, setAdjustNewStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // New Purchase state
  const [selectedIngId, setSelectedIngId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState<number>(0);
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');

  // Recipe mapping state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [mapIngId, setMapIngId] = useState('');
  const [mapQty, setMapQty] = useState<number>(0);

  // Sub-Recipe Editor state
  const [showSubRecipeModal, setShowSubRecipeModal] = useState(false);
  const [editingSubRecipeId, setEditingSubRecipeId] = useState<string | null>(null);
  const [subRecipeName, setSubRecipeName] = useState('');
  const [subRecipeUnit, setSubRecipeUnit] = useState('L');
  const [subRecipeYield, setSubRecipeYield] = useState<number>(1);
  const [subRecipeMinStock, setSubRecipeMinStock] = useState<number>(2);
  const [subRecipeChildItems, setSubRecipeChildItems] = useState<Array<{ childIngredientId: string; quantity: number }>>([]);

  // Production Batch state
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [produceSubRecipeId, setProduceSubRecipeId] = useState('');
  const [produceQuantity, setProduceQuantity] = useState<number>(1);
  const [produceNotes, setProduceNotes] = useState('');

  // Waste state
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteIngId, setWasteIngId] = useState('');
  const [wasteQuantity, setWasteQuantity] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState<string>('EXPIRATION');
  const [wasteWarehouseId, setWasteWarehouseId] = useState('');
  const [wasteNotes, setWasteNotes] = useState('');

  // Warehouse state
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [newWhCode, setNewWhCode] = useState('');
  const [newWhDescription, setNewWhDescription] = useState('');
  const [newWhIsDefault, setNewWhIsDefault] = useState(false);

  // Transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferIngId, setTransferIngId] = useState('');
  const [transferFromWhId, setTransferFromWhId] = useState('');
  const [transferToWhId, setTransferToWhId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState('');

  const fetchInventoryData = useCallback(async () => {
    try {
      const [invRes, prodRes, whRes, batchRes, wasteRes, transRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/products'),
        fetch('/api/inventory/warehouses'),
        fetch('/api/inventory/production'),
        fetch('/api/inventory/waste'),
        fetch('/api/inventory/transfers'),
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setIngredients(data.ingredients || []);
        setPurchases(data.purchases || []);
      }

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
        if (prodData.products?.length > 0 && !selectedProductId) {
          setSelectedProductId(prodData.products[0].id);
        }
      }

      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(whData.warehouses || []);
      }

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        setProductionBatches(batchData.batches || []);
      }

      if (wasteRes.ok) {
        const wasteData = await wasteRes.json();
        setWasteLogs(wasteData.wasteLogs || []);
        if (wasteData.summary) {
          setWasteSummary(wasteData.summary);
        }
      }

      if (transRes.ok) {
        const transData = await transRes.json();
        setTransfers(transData.transfers || []);
      }
    } catch (e) {
      console.error('Failed to fetch inventory data', e);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // Handle Add Ingredient
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
          parLevel: newIngParLevel,
          reorderPoint: newIngReorderPoint,
          cost: newIngCost,
          type: newIngType,
          allergens: newIngAllergens || null,
        }),
      });

      if (res.ok) {
        setShowAddIngModal(false);
        setNewIngName('');
        setNewIngStock(0);
        setNewIngParLevel(10);
        setNewIngReorderPoint(5);
        setNewIngCost(0);
        setNewIngAllergens('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al agregar insumo');
    }
  };

  // Handle Adjust Stock
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustIng) return;

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_stock',
          ingredientId: adjustIng.id,
          newStock: adjustNewStock,
          reason: adjustReason || 'Ajuste manual de existencias',
        }),
      });

      if (res.ok) {
        setShowAdjustModal(false);
        setAdjustIng(null);
        setAdjustReason('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al ajustar existencias');
    }
  };

  // Handle Purchase
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
        setPurchaseQty(0);
        setPurchaseCost(0);
        setPurchaseSupplier('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al registrar compra');
    }
  };

  // Handle Recipe mapping for products
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
    } catch {
      alert('Error al actualizar ficha técnica');
    }
  };

  // Handle Save Sub-Recipe
  const handleSaveSubRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subRecipeName || !subRecipeUnit || subRecipeYield <= 0 || subRecipeChildItems.length === 0) {
      alert('Por favor completa todos los campos requeridos y añade al menos un insumo base');
      return;
    }

    try {
      const res = await fetch('/api/inventory/sub-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSubRecipeId,
          name: subRecipeName,
          unit: subRecipeUnit,
          yieldQuantity: subRecipeYield,
          yieldUnit: subRecipeUnit,
          minStock: subRecipeMinStock,
          childItems: subRecipeChildItems,
        }),
      });

      if (res.ok) {
        setShowSubRecipeModal(false);
        setEditingSubRecipeId(null);
        setSubRecipeName('');
        setSubRecipeYield(1);
        setSubRecipeChildItems([]);
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al guardar la sub-receta');
    }
  };

  // Handle Production Batch
  const handleExecuteProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produceSubRecipeId || produceQuantity <= 0) return;

    try {
      const res = await fetch('/api/inventory/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: produceSubRecipeId,
          quantity: produceQuantity,
          notes: produceNotes,
        }),
      });

      if (res.ok) {
        setShowProduceModal(false);
        setProduceQuantity(1);
        setProduceNotes('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al registrar la producción');
    }
  };

  // Handle Record Waste
  const handleRecordWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteIngId || wasteQuantity <= 0) return;

    try {
      const res = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: wasteIngId,
          quantity: wasteQuantity,
          reason: wasteReason,
          warehouseId: wasteWarehouseId || null,
          notes: wasteNotes,
        }),
      });

      if (res.ok) {
        setShowWasteModal(false);
        setWasteQuantity(1);
        setWasteNotes('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al registrar merma');
    }
  };

  // Handle Create Warehouse
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName) return;

    try {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWhName,
          code: newWhCode,
          description: newWhDescription,
          isDefault: newWhIsDefault,
        }),
      });

      if (res.ok) {
        setShowWarehouseModal(false);
        setNewWhName('');
        setNewWhCode('');
        setNewWhDescription('');
        setNewWhIsDefault(false);
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al crear almacén');
    }
  };

  // Handle Warehouse Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferIngId || !transferFromWhId || !transferToWhId || transferQuantity <= 0) {
      alert('Por favor llena todos los campos del traspaso');
      return;
    }

    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: transferIngId,
          fromWarehouseId: transferFromWhId,
          toWarehouseId: transferToWhId,
          quantity: transferQuantity,
          notes: transferNotes,
        }),
      });

      if (res.ok) {
        setShowTransferModal(false);
        setTransferQuantity(1);
        setTransferNotes('');
        fetchInventoryData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al procesar el traspaso');
    }
  };

  // Sub-recipe helpers
  const subRecipesList = ingredients.filter(i => i.type === 'PREPARED');
  const rawIngredientsList = ingredients.filter(i => i.type !== 'PREPARED');

  const selectedProduceSubRecipe = ingredients.find(i => i.id === produceSubRecipeId);

  // Calculations
  const lowStockCount = ingredients.filter(i => i.stock < i.minStock).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + (i.stock * i.cost), 0);
  const activeProduct = products.find(p => p.id === selectedProductId);

  const filteredIngredients = ingredients.filter(i => {
    if (ingredientFilter === 'RAW') return i.type !== 'PREPARED';
    if (ingredientFilter === 'PREPARED') return i.type === 'PREPARED';
    return true;
  });

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'EXPIRATION': return 'Caducidad / Descomposición';
      case 'KITCHEN_ERROR': return 'Error de Cocina / Caído';
      case 'PREPARATION_WASTE': return 'Merma de Porcionado';
      case 'DAMAGE_SPILL': return 'Derrame / Accidente';
      default: return 'Otro Motivo';
    }
  };

  const getReasonBadgeClass = (reason: string) => {
    switch (reason) {
      case 'EXPIRATION': return 'bg-amber-950/50 text-amber-400 border-amber-800/50';
      case 'KITCHEN_ERROR': return 'bg-red-950/50 text-red-400 border-red-800/50';
      case 'PREPARATION_WASTE': return 'bg-blue-950/50 text-blue-400 border-blue-800/50';
      case 'DAMAGE_SPILL': return 'bg-purple-950/50 text-purple-400 border-purple-800/50';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando inventarios, sub-recetas y almacenes...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6 pb-12">
        {/* KPI Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Insumos Registrados</p>
              <h3 className="text-2xl font-black text-white mt-1">{ingredients.length}</h3>
              <p className="text-xs text-slate-500 mt-1">{rawIngredientsList.length} materias primas, {subRecipesList.length} sub-recetas</p>
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
              <p className="text-sm font-semibold text-slate-400">Valor de Almacén</p>
              <h3 className="text-2xl font-black text-white mt-1">${totalValuation.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-500 mt-1">Valuación total ponderada</p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Pérdida por Mermas</p>
              <h3 className="text-2xl font-black text-red-400 mt-1">${wasteSummary.totalWasteCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-500 mt-1">{wasteSummary.totalEvents} incidencias registradas</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20">
              <Trash2 className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-6 text-sm shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ingredients' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="h-4 w-4" /> Insumos & Stock
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'batches' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="h-4 w-4 text-amber-400" /> Lotes & Caducidad (FIFO/FEFO)
          </button>
          <button
            onClick={() => setActiveTab('subrecipes')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'subrecipes' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="h-4 w-4" /> Sub-recetas & Producción
          </button>
          <button
            onClick={() => setActiveTab('waste')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'waste' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Trash2 className="h-4 w-4" /> Control de Mermas & RCA
          </button>
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'warehouses' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <WarehouseIcon className="h-4 w-4" /> Bodegas & Traspasos
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'purchases' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> Compras & Auto-PO
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'recipes' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Utensils className="h-4 w-4" /> Fichas de Platillos
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'audit' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="h-4 w-4 text-amber-400" /> Auditoría & Food Cost
          </button>
          <button
            onClick={() => setActiveTab('requisitions')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requisitions' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4 text-indigo-400" /> Requisiciones & Despacho
          </button>
          <button
            onClick={() => setActiveTab('prep')}
            className={`pb-3 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'prep' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="h-4 w-4 text-amber-400" /> Prep List & Forecast
          </button>
        </div>

        {/* TAB 1: INGREDIENTS & STOCK */}
        {activeTab === 'ingredients' && (
          <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="font-bold text-white text-base">Almacén General de Insumos</h4>
                  <p className="text-xs text-slate-500 mt-1">Existencias consolidadas, costos promedio y alertas de existencias mínimas.</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
                  <button
                    onClick={() => setIngredientFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                      ingredientFilter === 'ALL' ? 'bg-brand-primary text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({ingredients.length})
                  </button>
                  <button
                    onClick={() => setIngredientFilter('RAW')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                      ingredientFilter === 'RAW' ? 'bg-brand-primary text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Materia Prima ({rawIngredientsList.length})
                  </button>
                  <button
                    onClick={() => setIngredientFilter('PREPARED')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                      ingredientFilter === 'PREPARED' ? 'bg-brand-primary text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sub-recetas ({subRecipesList.length})
                  </button>
                </div>

                <button
                  onClick={() => setShowAddIngModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3px]" /> Nuevo Insumo
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Insumo</th>
                    <th className="p-4">Costo Unitario</th>
                    <th className="p-4">Stock Mínimo</th>
                    <th className="p-4">Stock Actual</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Valor Total</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">No se encontraron insumos con el filtro seleccionado.</td>
                    </tr>
                  ) : (
                    filteredIngredients.map((ing) => {
                      const isLow = ing.stock < ing.minStock;
                      const isPrepared = ing.type === 'PREPARED';
                      return (
                        <tr key={ing.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-4">
                            {isPrepared ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-950/40 border border-purple-900/50 px-2 py-0.5 rounded">
                                <ChefHat className="h-3 w-3" /> Sub-receta
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-900/50 px-2 py-0.5 rounded">
                                <Package className="h-3 w-3" /> Materia Prima
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-bold text-white text-sm">
                            {ing.name}
                            {ing.allergens && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.5 rounded mt-1">
                                ⚠️ {ing.allergens}
                              </span>
                            )}
                            {isPrepared && ing.yieldQuantity && (
                              <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                                Rendimiento: {ing.yieldQuantity} {ing.yieldUnit || ing.unit}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-300 font-semibold">${ing.cost.toFixed(2)} / {ing.unit}</td>
                          <td className="p-4 text-slate-400">{ing.minStock} {ing.unit}</td>
                          <td className={`p-4 font-black text-sm ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
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
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                setAdjustIng(ing);
                                setAdjustNewStock(ing.stock);
                                setShowAdjustModal(true);
                              }}
                              className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded text-xs transition-colors cursor-pointer"
                              title="Ajuste manual de existencias"
                            >
                              Ajustar Stock
                            </button>
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

        {/* TAB: BATCHES & EXPIRATION (FEFO / FIFO) */}
        {activeTab === 'batches' && (
          <BatchTrackingTab
            ingredients={ingredients}
            warehouses={warehouses}
            onStockUpdated={fetchInventoryData}
          />
        )}

        {/* TAB 2: SUB-RECIPES & PRODUCTION */}
        {activeTab === 'subrecipes' && (
          <div className="space-y-6">
            <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
                <div>
                  <h4 className="font-bold text-white text-base">Sub-recetas & Alimentos Preparados</h4>
                  <p className="text-xs text-slate-500 mt-1">Fórmulas de insumos elaborados en cocina a partir de materias primas con cálculo de costo y rendimiento.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (subRecipesList.length === 0) {
                        alert('Primero debes registrar al menos una sub-receta');
                        return;
                      }
                      setProduceSubRecipeId(subRecipesList[0].id);
                      setProduceQuantity(1);
                      setShowProduceModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer"
                  >
                    <Flame className="h-4 w-4" /> Producir Lote
                  </button>
                  <button
                    onClick={() => {
                      setEditingSubRecipeId(null);
                      setSubRecipeName('');
                      setSubRecipeUnit('L');
                      setSubRecipeYield(1);
                      setSubRecipeChildItems([]);
                      setShowSubRecipeModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[3px]" /> Nueva Sub-receta
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-5">
                {subRecipesList.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500">
                    <ChefHat className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                    <p className="font-bold text-white">Sin sub-recetas configuradas</p>
                    <p className="text-xs text-slate-400 mt-1">Registra salsas, masas o aderezos preparados para controlar la explosión de materias primas.</p>
                  </div>
                ) : (
                  subRecipesList.map((sr) => {
                    const children = sr.parentSubRecipes || [];
                    const batchCost = children.reduce((acc, c) => acc + (c.quantity * c.childIngredient.cost), 0);
                    const unitCost = sr.yieldQuantity ? batchCost / sr.yieldQuantity : sr.cost;

                    return (
                      <div key={sr.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-purple-400 bg-purple-950/50 border border-purple-800/50 px-2 py-0.5 rounded">
                                Sub-receta
                              </span>
                              <h5 className="font-bold text-white text-base mt-1">{sr.name}</h5>
                            </div>
                            <button
                              onClick={() => {
                                setEditingSubRecipeId(sr.id);
                                setSubRecipeName(sr.name);
                                setSubRecipeUnit(sr.unit);
                                setSubRecipeYield(sr.yieldQuantity || 1);
                                setSubRecipeMinStock(sr.minStock);
                                setSubRecipeChildItems((sr.parentSubRecipes || []).map(c => ({
                                  childIngredientId: c.childIngredientId,
                                  quantity: c.quantity
                                })));
                                setShowSubRecipeModal(true);
                              }}
                              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                              title="Editar sub-receta"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 bg-slate-900/60 rounded-lg text-xs">
                            <div>
                              <p className="text-slate-500">Rendimiento</p>
                              <p className="font-bold text-white">{sr.yieldQuantity || 1} {sr.yieldUnit || sr.unit}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Costo Unitario</p>
                              <p className="font-bold text-emerald-400">${unitCost.toFixed(2)} / {sr.unit}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Stock Actual</p>
                              <p className="font-bold text-white">{sr.stock.toFixed(2)} {sr.unit}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Costo Lote</p>
                              <p className="font-bold text-slate-300">${batchCost.toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ingredientes Requeridos:</p>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                              {children.length === 0 ? (
                                <p className="text-xs text-slate-600 italic">Sin ingredientes asignados</p>
                              ) : (
                                children.map(c => (
                                  <div key={c.id} className="flex justify-between items-center text-xs text-slate-300 bg-slate-900/40 px-2.5 py-1.5 rounded">
                                    <span>{c.childIngredient.name}</span>
                                    <span className="font-bold text-slate-400">{c.quantity} {c.childIngredient.unit}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/80">
                          <button
                            onClick={() => {
                              setProduceSubRecipeId(sr.id);
                              setProduceQuantity(sr.yieldQuantity || 1);
                              setShowProduceModal(true);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Flame className="h-3.5 w-3.5" /> Preparar este Lote
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Production Batches Log */}
            <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-800 bg-slate-900/40">
                <h4 className="font-bold text-white text-base">Historial de Lotes Producidos</h4>
                <p className="text-xs text-slate-500 mt-1">Registro de órdenes de cocina con insumos consumidos y costo total absorbido.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-4">Fecha y Hora</th>
                      <th className="p-4">Sub-receta</th>
                      <th className="p-4">Cantidad Producida</th>
                      <th className="p-4">Costo Total</th>
                      <th className="p-4">Costo Unitario</th>
                      <th className="p-4">Responsable</th>
                      <th className="p-4">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {productionBatches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">No hay lotes de producción registrados aún.</td>
                      </tr>
                    ) : (
                      productionBatches.map(b => (
                        <tr key={b.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 text-slate-400 font-mono">
                            {new Date(b.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold text-white">{b.ingredient.name}</td>
                          <td className="p-4 font-black text-emerald-400">+{b.quantity} {b.ingredient.unit}</td>
                          <td className="p-4 font-bold text-slate-300">${b.totalCost.toFixed(2)}</td>
                          <td className="p-4 text-slate-400">${b.unitCost.toFixed(2)} / {b.ingredient.unit}</td>
                          <td className="p-4 text-slate-300">{b.user?.name || 'Sistema'}</td>
                          <td className="p-4 text-slate-400 italic">{b.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WASTE CONTROL & RCA */}
        {activeTab === 'waste' && (
          <WasteManagementHubTab
            ingredients={ingredients}
            warehouses={warehouses}
            onRefreshAll={fetchInventoryData}
          />
        )}

        {/* TAB 4: WAREHOUSES & TRANSFERS */}
        {activeTab === 'warehouses' && (
          <div className="space-y-6">
            <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
                <div>
                  <h4 className="font-bold text-white text-base">Bodegas & Centros de Almacenamiento</h4>
                  <p className="text-xs text-slate-500 mt-1">Ubicación de mercancías en almacén central, cocina caliente, barra o cámaras de refrigeración.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (warehouses.length < 2) {
                        alert('Se requieren al menos 2 almacenes para realizar traspasos');
                        return;
                      }
                      setTransferFromWhId(warehouses[0].id);
                      setTransferToWhId(warehouses[1].id);
                      setTransferIngId(ingredients[0]?.id || '');
                      setShowTransferModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer"
                  >
                    <ArrowRightLeft className="h-4 w-4" /> Traspaso entre Bodegas
                  </button>
                  <button
                    onClick={() => setShowWarehouseModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg shadow-lg cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[3px]" /> Nueva Bodega
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5">
                {warehouses.map(wh => (
                  <div key={wh.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded">
                          {wh.code || 'BOD'}
                        </span>
                        {wh.isDefault && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded">
                            Principal
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-white text-base mt-2">{wh.name}</h5>
                      <p className="text-xs text-slate-400 mt-1">{wh.description || 'Sin descripción'}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                      <span>Existencias registradas:</span>
                      <span className="font-bold text-white">{wh.stocks?.length || 0} insumos</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfers Log */}
            <div className="glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-800 bg-slate-900/40">
                <h4 className="font-bold text-white text-base">Bitácora de Traspasos Internos</h4>
                <p className="text-xs text-slate-500 mt-1">Historial de movimientos de insumos entre bodegas con firmas de responsable.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-4">Fecha y Hora</th>
                      <th className="p-4">Insumo</th>
                      <th className="p-4">Cantidad</th>
                      <th className="p-4">Almacén Origen</th>
                      <th className="p-4">Almacén Destino</th>
                      <th className="p-4">Responsable</th>
                      <th className="p-4">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {transfers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">No hay traspasos registrados.</td>
                      </tr>
                    ) : (
                      transfers.map(t => (
                        <tr key={t.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 text-slate-400 font-mono">
                            {new Date(t.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold text-white">{t.ingredient.name}</td>
                          <td className="p-4 font-black text-brand-primary">{t.quantity} {t.ingredient.unit}</td>
                          <td className="p-4 text-slate-300">{t.fromWarehouse.name}</td>
                          <td className="p-4 text-slate-300 font-semibold">{t.toWarehouse.name}</td>
                          <td className="p-4 text-slate-400">{t.user?.name || 'Almacenista'}</td>
                          <td className="p-4 text-slate-500 italic">{t.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PURCHASES & AUTO-PO */}
        {activeTab === 'purchases' && (
          <div className="space-y-8">
            <PurchaseOrdersTab
              availableIngredients={ingredients}
              onRefreshInventory={fetchInventoryData}
            />

            {/* Collapsible Quick Purchase Legacy Option */}
            <details className="glass-panel border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg group">
              <summary className="p-4 bg-slate-900/60 font-bold text-xs text-slate-400 hover:text-white cursor-pointer flex items-center justify-between transition-colors">
                <span>➕ Registrar Entrada Rápida Sin Orden de Compra (Legacy)</span>
                <span className="text-[11px] text-slate-500">Haz clic para desplegar</span>
              </summary>
              <div className="p-5 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-950/40">
                <div className="lg:col-span-1 space-y-4">
                  <div>
                    <h5 className="font-bold text-white text-sm">Entrada Rápida de Stock</h5>
                    <p className="text-xs text-slate-500 mt-0.5">Incremento directo para compras inmediatas al contado.</p>
                  </div>
                  <form onSubmit={handleRegisterPurchase} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Insumo *</label>
                      <select
                        value={selectedIngId}
                        onChange={(e) => setSelectedIngId(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-brand-primary focus:outline-none"
                      >
                        <option value="">Selecciona un insumo</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit}) - Stock: {ing.stock.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Cantidad *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={purchaseQty || ''}
                          onChange={(e) => setPurchaseQty(parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-brand-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Costo Total ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={purchaseCost || ''}
                          onChange={(e) => setPurchaseCost(parseFloat(e.target.value))}
                          placeholder="$ 0.00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-brand-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Proveedor (Opcional)</label>
                      <input
                        type="text"
                        value={purchaseSupplier}
                        onChange={(e) => setPurchaseSupplier(e.target.value)}
                        placeholder="Ej. Mercado de Abastos"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-brand-primary focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Registrar Entrada Inmediata
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 overflow-x-auto">
                  <h5 className="font-bold text-white text-sm mb-3">Historial de Entradas Directas</h5>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Insumo</th>
                        <th className="p-3">Cantidad</th>
                        <th className="p-3">Costo Total</th>
                        <th className="p-3">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {purchases.slice(0, 5).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/30">
                          <td className="p-3 text-slate-400 font-mono">{new Date(p.purchaseDate).toLocaleDateString('es-MX')}</td>
                          <td className="p-3 font-bold text-white">{p.ingredient.name}</td>
                          <td className="p-3 text-emerald-400 font-bold">+{p.quantity} {p.ingredient.unit}</td>
                          <td className="p-3 text-slate-200">${p.cost.toFixed(2)}</td>
                          <td className="p-3 text-slate-400">{p.supplier || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* TAB 6: RECIPES FOR PRODUCTS */}
        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div>
                <h4 className="font-bold text-white text-base">Ficha Técnica de Platillo</h4>
                <p className="text-xs text-slate-500 mt-1">Configura la cantidad exacta de ingredientes que se descuentan al vender el producto.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Platillo del Menú *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleSaveRecipeItem} className="space-y-4 pt-3 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Insumo Requerido *</label>
                  <select
                    value={mapIngId}
                    onChange={(e) => setMapIngId(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                  >
                    <option value="">Selecciona ingrediente</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}) {ing.type === 'PREPARED' ? '[Sub-receta]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cantidad Consumida por Orden *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={mapQty || ''}
                    onChange={(e) => setMapQty(parseFloat(e.target.value))}
                    placeholder="Ej. 0.200 (para 200g)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg transition-colors cursor-pointer"
                >
                  Guardar en Receta
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-white text-base">
                    Ingredientes de: <span className="text-brand-primary">{activeProduct?.name || 'Ninguno'}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Explosión de materias primas al entregar la comanda.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-3.5">Ingrediente</th>
                      <th className="p-3.5">Cantidad Consumida</th>
                      <th className="p-3.5">Costo Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(!activeProduct || !activeProduct.recipeItems || activeProduct.recipeItems.length === 0) ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-slate-500">
                          Este platillo no tiene ficha técnica asignada.
                        </td>
                      </tr>
                    ) : (
                      activeProduct.recipeItems.map((item) => {
                        const ing = ingredients.find(i => i.id === item.ingredientId);
                        const cost = ing ? ing.cost * item.quantity : 0;
                        return (
                          <tr key={item.id} className="hover:bg-slate-900/30">
                            <td className="p-3.5 font-bold text-white">{ing?.name || 'Insumo eliminado'}</td>
                            <td className="p-3.5 text-slate-300 font-semibold">
                              {item.quantity} {ing?.unit || 'uds'}
                            </td>
                            <td className="p-3.5 text-slate-200 font-bold">${cost.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: COST AUDIT & FOOD COST */}
        {activeTab === 'audit' && (
          <FoodCostAuditTab
            ingredients={ingredients}
            warehouses={warehouses}
            onRefreshAll={fetchInventoryData}
          />
        )}

        {/* TAB 8: REQUISITIONS & DISPATCH */}
        {activeTab === 'requisitions' && (
          <RequisitionsTab
            ingredients={ingredients}
            warehouses={warehouses}
            onRefreshAll={fetchInventoryData}
          />
        )}

        {/* TAB 9: PREP LIST PREDICTIVA & DEMAND FORECAST */}
        {activeTab === 'prep' && (
          <DailyPrepStationView />
        )}

        {/* MODAL: ADD INGREDIENT */}
        {showAddIngModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Nuevo Insumo / Materia Prima</h3>
                <button onClick={() => setShowAddIngModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddIngredient} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Insumo *</label>
                  <input
                    type="text"
                    required
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    placeholder="Ej. Jitomate Saladette"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Unidad de Medida *</label>
                    <select
                      value={newIngUnit}
                      onChange={(e) => setNewIngUnit(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    >
                      <option value="kg">kg (Kilogramo)</option>
                      <option value="g">g (Gramo)</option>
                      <option value="L">L (Litro)</option>
                      <option value="ml">ml (Mililitro)</option>
                      <option value="pzs">pzs (Piezas)</option>
                      <option value="latas">latas (Latas)</option>
                      <option value="paq">paq (Paquete)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Insumo</label>
                    <select
                      value={newIngType}
                      onChange={(e) => setNewIngType(e.target.value as 'RAW' | 'PREPARED')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    >
                      <option value="RAW">Materia Prima Directa</option>
                      <option value="PREPARED">Sub-receta / Preparado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Stock Inicial</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newIngStock || ''}
                      onChange={(e) => setNewIngStock(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Costo Unitario ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newIngCost || ''}
                      onChange={(e) => setNewIngCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Punto de Reorden (Alerta Pedido)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newIngReorderPoint || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setNewIngReorderPoint(val);
                        setNewIngMinStock(val);
                      }}
                      placeholder="5"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1">Nivel Par Óptimo (Capacidad)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newIngParLevel || ''}
                      onChange={(e) => setNewIngParLevel(parseFloat(e.target.value) || 0)}
                      placeholder="10"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Alérgenos / Alertas (separados por coma)</label>
                  <input
                    type="text"
                    value={newIngAllergens}
                    onChange={(e) => setNewIngAllergens(e.target.value)}
                    placeholder="Ej. Gluten, Lácteos, Cacahuates"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['Gluten', 'Lácteos', 'Huevos', 'Cacahuates', 'Mariscos', 'Soya', 'Pescado', 'Nueces'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = newIngAllergens ? newIngAllergens.split(',').map(s => s.trim()).filter(Boolean) : [];
                          if (current.includes(tag)) {
                            setNewIngAllergens(current.filter(t => t !== tag).join(', '));
                          } else {
                            setNewIngAllergens([...current, tag].join(', '));
                          }
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          newIngAllergens.toLowerCase().includes(tag.toLowerCase())
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddIngModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Crear Insumo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADJUST STOCK */}
        {showAdjustModal && adjustIng && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Ajuste de Existencias</h3>
                  <p className="text-xs text-slate-400">{adjustIng.name} ({adjustIng.unit})</p>
                </div>
                <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAdjustStock} className="space-y-4">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex justify-between text-xs">
                  <span className="text-slate-400">Stock Actual del Sistema:</span>
                  <span className="font-bold text-white">{adjustIng.stock.toFixed(2)} {adjustIng.unit}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nuevo Conteo Físico Real *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={adjustNewStock}
                    onChange={(e) => setAdjustNewStock(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Diferencia: {(adjustNewStock - adjustIng.stock).toFixed(2)} {adjustIng.unit}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo / Justificación *</label>
                  <input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ej. Conteo físico fin de mes / Corrección de inventario"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Confirmar Ajuste
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SUB-RECIPE BUILDER */}
        {showSubRecipeModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingSubRecipeId ? 'Editar Sub-receta' : 'Nueva Sub-receta / Preparado'}
                  </h3>
                  <p className="text-xs text-slate-400">Define la fórmula técnica para preparación en cocina.</p>
                </div>
                <button onClick={() => setShowSubRecipeModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSubRecipe} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre de la Sub-receta *</label>
                    <input
                      type="text"
                      required
                      value={subRecipeName}
                      onChange={(e) => setSubRecipeName(e.target.value)}
                      placeholder="Ej. Salsa Pomodoro de la Casa"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Unidad *</label>
                    <select
                      value={subRecipeUnit}
                      onChange={(e) => setSubRecipeUnit(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    >
                      <option value="L">L (Litro)</option>
                      <option value="kg">kg (Kilogramo)</option>
                      <option value="pzs">pzs (Piezas)</option>
                      <option value="porciones">porciones</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Rendimiento por Lote *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={subRecipeYield}
                      onChange={(e) => setSubRecipeYield(parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Cantidad neta producida por preparación.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Stock Mínimo en Cocina</label>
                    <input
                      type="number"
                      step="0.01"
                      value={subRecipeMinStock}
                      onChange={(e) => setSubRecipeMinStock(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Ingredients selection */}
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ingredientes de la Fórmula:</h5>
                    <button
                      type="button"
                      onClick={() => {
                        const firstRaw = rawIngredientsList[0]?.id || '';
                        setSubRecipeChildItems([...subRecipeChildItems, { childIngredientId: firstRaw, quantity: 1 }]);
                      }}
                      className="flex items-center gap-1 text-xs text-brand-primary hover:underline font-bold cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir Ingrediente
                    </button>
                  </div>

                  {subRecipeChildItems.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">No has añadido ingredientes base a esta sub-receta.</p>
                  ) : (
                    <div className="space-y-2">
                      {subRecipeChildItems.map((item, index) => {
                        const child = rawIngredientsList.find(r => r.id === item.childIngredientId);
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <select
                              value={item.childIngredientId}
                              onChange={(e) => {
                                const newItems = [...subRecipeChildItems];
                                newItems[index].childIngredientId = e.target.value;
                                setSubRecipeChildItems(newItems);
                              }}
                              className="w-7/12 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            >
                              {rawIngredientsList.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.name} (${r.cost.toFixed(2)}/{r.unit})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.001"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const newItems = [...subRecipeChildItems];
                                newItems[index].quantity = parseFloat(e.target.value) || 0;
                                setSubRecipeChildItems(newItems);
                              }}
                              placeholder="Cantidad"
                              className="w-4/12 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            />
                            <span className="text-xs text-slate-400 w-12 text-center">{child?.unit || 'ud'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = subRecipeChildItems.filter((_, i) => i !== index);
                                setSubRecipeChildItems(newItems);
                              }}
                              className="text-red-400 hover:text-red-300 p-1.5 cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSubRecipeModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Guardar Sub-receta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: PRODUCE BATCH */}
        {showProduceModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Preparar Lote en Cocina</h3>
                  <p className="text-xs text-slate-400">Descuenta materias primas y carga stock del producto preparado.</p>
                </div>
                <button onClick={() => setShowProduceModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteProduction} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Sub-receta a Preparar *</label>
                  <select
                    value={produceSubRecipeId}
                    onChange={(e) => setProduceSubRecipeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  >
                    {subRecipesList.map(sr => (
                      <option key={sr.id} value={sr.id}>
                        {sr.name} (Rendimiento: {sr.yieldQuantity || 1} {sr.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Cantidad a Producir *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={produceQuantity}
                      onChange={(e) => setProduceQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400 w-16">
                      {selectedProduceSubRecipe?.yieldUnit || selectedProduceSubRecipe?.unit || 'uds'}
                    </span>
                  </div>
                </div>

                {/* Pre-check required child ingredients */}
                {selectedProduceSubRecipe && selectedProduceSubRecipe.parentSubRecipes && (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Materias primas requeridas:</p>
                    <div className="space-y-1">
                      {selectedProduceSubRecipe.parentSubRecipes.map(c => {
                        const mult = produceQuantity / (selectedProduceSubRecipe.yieldQuantity || 1);
                        const reqQty = c.quantity * mult;
                        const hasEnough = c.childIngredient.stock >= reqQty;

                        return (
                          <div key={c.id} className="flex justify-between items-center text-xs">
                            <span className="text-slate-300">{c.childIngredient.name}</span>
                            <span className={`font-mono font-bold ${hasEnough ? 'text-emerald-400' : 'text-red-400'}`}>
                              {reqQty.toFixed(2)} / {c.childIngredient.stock.toFixed(2)} {c.childIngredient.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Notas / Observaciones</label>
                  <input
                    type="text"
                    value={produceNotes}
                    onChange={(e) => setProduceNotes(e.target.value)}
                    placeholder="Ej. Preparación turno matutino"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProduceModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Confirmar Producción
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD WASTE */}
        {showWasteModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Registro de Merma Operativa</h3>
                  <p className="text-xs text-slate-400">Descuenta insumos perdidos y cuantifica el costo financiero.</p>
                </div>
                <button onClick={() => setShowWasteModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleRecordWaste} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Insumo Afectado *</label>
                  <select
                    value={wasteIngId}
                    onChange={(e) => setWasteIngId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  >
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}) - Costo: ${ing.cost.toFixed(2)}/ud
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Cantidad Perdida *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={wasteQuantity}
                      onChange={(e) => setWasteQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo de Merma *</label>
                    <select
                      value={wasteReason}
                      onChange={(e) => setWasteReason(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    >
                      <option value="EXPIRATION">Caducidad / Descomposición</option>
                      <option value="KITCHEN_ERROR">Error Cocina / Plato Caído</option>
                      <option value="PREPARATION_WASTE">Merma de Porcionado / Limpieza</option>
                      <option value="DAMAGE_SPILL">Derrame / Empaque Roto</option>
                      <option value="OTHER">Otro Motivo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Bodega Afectada (Opcional)</label>
                  <select
                    value={wasteWarehouseId}
                    onChange={(e) => setWasteWarehouseId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  >
                    <option value="">Almacén General</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Observaciones / Justificación</label>
                  <input
                    type="text"
                    value={wasteNotes}
                    onChange={(e) => setWasteNotes(e.target.value)}
                    placeholder="Ej. Se quemó en parrilla durante hora pico"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWasteModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Confirmar Merma
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NEW WAREHOUSE */}
        {showWarehouseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Nueva Bodega / Almacén</h3>
                <button onClick={() => setShowWarehouseModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateWarehouse} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Almacén *</label>
                  <input
                    type="text"
                    required
                    value={newWhName}
                    onChange={(e) => setNewWhName(e.target.value)}
                    placeholder="Ej. Barra de Bebidas / Cocina Caliente"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Código Identificador</label>
                  <input
                    type="text"
                    value={newWhCode}
                    onChange={(e) => setNewWhCode(e.target.value)}
                    placeholder="Ej. BAR-01 / COC-01"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={newWhDescription}
                    onChange={(e) => setNewWhDescription(e.target.value)}
                    placeholder="Ej. Ubicado junto a la estación de coctelería"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDefaultWh"
                    checked={newWhIsDefault}
                    onChange={(e) => setNewWhIsDefault(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-brand-primary focus:ring-0"
                  />
                  <label htmlFor="isDefaultWh" className="text-xs text-slate-300">
                    Establecer como almacén principal por defecto
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWarehouseModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Crear Bodega
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: WAREHOUSE TRANSFER */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Traspaso entre Almacenes</h3>
                  <p className="text-xs text-slate-400">Reubicación de mercancía entre centros de consumo.</p>
                </div>
                <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteTransfer} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Insumo a Mover *</label>
                  <select
                    value={transferIngId}
                    onChange={(e) => setTransferIngId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  >
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}) - Stock Total: {ing.stock.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Origen *</label>
                    <select
                      value={transferFromWhId}
                      onChange={(e) => setTransferFromWhId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    >
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Destino *</label>
                    <select
                      value={transferToWhId}
                      onChange={(e) => setTransferToWhId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                    >
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Cantidad a Traspasar *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Notas de Traspaso</label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Ej. Solicitud para turno de la noche"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Ejecutar Traspaso
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
