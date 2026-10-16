'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Zap,
  Building2,
  FileText,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Truck,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Eye,
  PackageCheck,
  XCircle,
  FileCheck,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  code?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  isActive: boolean;
  ingredients?: Array<{
    id: string;
    ingredientId: string;
    supplierSku?: string | null;
    negotiatedCost: number;
    isPreferred: boolean;
    minOrderQty?: number | null;
    ingredient: {
      id: string;
      name: string;
      unit: string;
      cost: number;
      stock: number;
      parLevel?: number | null;
      reorderPoint?: number | null;
    };
  }>;
  _count?: {
    purchaseOrders: number;
  };
}

interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  ingredientId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  notes?: string | null;
  ingredient: {
    id: string;
    name: string;
    unit: string;
    cost: number;
    stock: number;
  };
}

interface PurchaseOrder {
  id: string;
  folio: string;
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    paymentTerms?: string | null;
  };
  createdBy?: {
    name: string;
  } | null;
  receivedBy?: {
    name: string;
  } | null;
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  expectedDate?: string | null;
  receivedDate?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentTerms?: string | null;
  invoiceRef?: string | null;
  notes?: string | null;
  items: PurchaseOrderItem[];
  createdAt: string;
}

interface AutoSuggestion {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  minStock: number;
  reorderPoint: number;
  parLevel: number;
  suggestedQty: number;
  preferredSupplier: {
    id: string;
    name: string;
    negotiatedCost: number;
    supplierSku?: string | null;
    leadTimeDays?: number | null;
    paymentTerms?: string | null;
  } | null;
  availableSuppliers: Array<{
    id: string;
    name: string;
    negotiatedCost: number;
    isPreferred: boolean;
  }>;
  estimatedUnitCost: number;
  estimatedTotal: number;
}

interface PurchaseOrdersTabProps {
  availableIngredients: Array<{
    id: string;
    name: string;
    unit: string;
    cost: number;
    stock: number;
    minStock: number;
    parLevel?: number | null;
    reorderPoint?: number | null;
  }>;
  onRefreshInventory?: () => void;
}

export default function PurchaseOrdersTab({ availableIngredients, onRefreshInventory }: PurchaseOrdersTabProps) {
  const [subTab, setSubTab] = useState<'suggestions' | 'orders' | 'suppliers'>('suggestions');
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suggestions, setSuggestions] = useState<AutoSuggestion[]>([]);

  // Selection state for auto suggestions
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, {
    selected: boolean;
    quantity: number;
    supplierId: string;
    unitCost: number;
  }>>({});

  // Filters for Purchase Orders
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showNewPOModal, setShowNewPOModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPOForReceive, setSelectedPOForReceive] = useState<PurchaseOrder | null>(null);

  // New PO Form state
  const [newPOSupplierId, setNewPOSupplierId] = useState('');
  const [newPOExpectedDate, setNewPOExpectedDate] = useState('');
  const [newPOPaymentTerms, setNewPOPaymentTerms] = useState('CONTADO');
  const [newPOTaxRate, setNewPOTaxRate] = useState('0.16');
  const [newPONotes, setNewPONotes] = useState('');
  const [newPOItems, setNewPOItems] = useState<Array<{
    ingredientId: string;
    quantityOrdered: number;
    unitCost: number;
    notes?: string;
  }>>([{ ingredientId: '', quantityOrdered: 1, unitCost: 0 }]);

  // Supplier Form state
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: '',
    contactName: '',
    email: '',
    phone: '',
    taxId: '',
    address: '',
    paymentTerms: 'CONTADO',
    leadTimeDays: 1,
    notes: '',
    ingredientCosts: [] as Array<{
      ingredientId: string;
      negotiatedCost: number;
      supplierSku: string;
      isPreferred: boolean;
      minOrderQty: number;
    }>,
  });

  // Receiving state
  const [receiveInvoiceRef, setReceiveInvoiceRef] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receivedItemInputs, setReceivedItemInputs] = useState<Record<string, {
    quantityReceived: number;
    unitCost: number;
  }>>({});

  // Alerts & Messages
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage({ text, type });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // 1. Fetch Suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  }, []);

  // 2. Fetch Purchase Orders
  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (supplierFilter !== 'ALL') query.set('supplierId', supplierFilter);
      if (searchQuery.trim()) query.set('search', searchQuery.trim());

      const res = await fetch(`/api/inventory/purchase-orders?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPurchaseOrders(data.purchaseOrders || []);
      }
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
    }
  }, [statusFilter, supplierFilter, searchQuery]);

  // 3. Fetch Auto-Suggestions
  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/purchase-orders?mode=auto_suggest');
      if (res.ok) {
        const data = await res.json();
        const suggList: AutoSuggestion[] = data.suggestions || [];
        setSuggestions(suggList);

        // Initialize selection state
        const initialMap: Record<string, { selected: boolean; quantity: number; supplierId: string; unitCost: number }> = {};
        suggList.forEach((s) => {
          initialMap[s.ingredientId] = {
            selected: true,
            quantity: s.suggestedQty,
            supplierId: s.preferredSupplier?.id || (s.availableSuppliers[0]?.id || ''),
            unitCost: s.estimatedUnitCost,
          };
        });
        setSelectedSuggestions(initialMap);
      }
    } catch (err) {
      console.error('Error fetching auto suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchPurchaseOrders();
    fetchSuggestions();
  }, [fetchSuppliers, fetchPurchaseOrders, fetchSuggestions]);

  // Action: Generate Auto POs
  const handleGenerateAutoPOs = async () => {
    const itemsToOrder = Object.entries(selectedSuggestions)
      .filter(([_, val]) => val.selected && val.supplierId && val.quantity > 0)
      .map(([ingId, val]) => ({
        ingredientId: ingId,
        quantity: val.quantity,
        supplierId: val.supplierId,
        unitCost: val.unitCost,
      }));

    if (itemsToOrder.length === 0) {
      showAlert('Selecciona al menos un insumo con proveedor asignado para generar órdenes.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_auto_pos',
          selectedSuggestions: itemsToOrder,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(data.message || 'Órdenes de compra generadas exitosamente');
        fetchPurchaseOrders();
        fetchSuggestions();
        setSubTab('orders');
      } else {
        showAlert(data.error || 'Error al generar órdenes de compra', 'error');
      }
    } catch (err) {
      showAlert('Error de conexión al generar órdenes de compra', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Create Manual PO
  const handleCreateManualPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOSupplierId) {
      showAlert('Selecciona un proveedor', 'error');
      return;
    }

    const validItems = newPOItems.filter((it) => it.ingredientId && it.quantityOrdered > 0);
    if (validItems.length === 0) {
      showAlert('Agrega al menos un insumo válido con cantidad mayor a cero', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: newPOSupplierId,
          expectedDate: newPOExpectedDate || null,
          paymentTerms: newPOPaymentTerms,
          taxRate: parseFloat(newPOTaxRate) || 0,
          notes: newPONotes,
          items: validItems,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(`Orden ${data.purchaseOrder.folio} creada con éxito`);
        setShowNewPOModal(false);
        setNewPOItems([{ ingredientId: '', quantityOrdered: 1, unitCost: 0 }]);
        setNewPONotes('');
        fetchPurchaseOrders();
      } else {
        showAlert(data.error || 'Error al crear orden de compra', 'error');
      }
    } catch (err) {
      showAlert('Error al procesar la solicitud', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Open Receive Modal
  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPOForReceive(po);
    setReceiveInvoiceRef(po.invoiceRef || '');
    setReceiveNotes('');

    const initialInputs: Record<string, { quantityReceived: number; unitCost: number }> = {};
    po.items.forEach((item) => {
      const pendingQty = Math.max(0, item.quantityOrdered - item.quantityReceived);
      initialInputs[item.id] = {
        quantityReceived: pendingQty,
        unitCost: item.unitCost,
      };
    });
    setReceivedItemInputs(initialInputs);
    setShowReceiveModal(true);
  };

  // Action: Confirm Receipt of PO
  const handleConfirmReceive = async () => {
    if (!selectedPOForReceive) return;

    const payloadItems = Object.entries(receivedItemInputs).map(([itemId, val]) => ({
      itemId,
      quantityReceived: val.quantityReceived,
      unitCost: val.unitCost,
    })).filter((it) => it.quantityReceived > 0);

    if (payloadItems.length === 0) {
      showAlert('Ingresa una cantidad recibida mayor a 0 en al menos un insumo', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/purchase-orders/${selectedPOForReceive.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedItems: payloadItems,
          invoiceRef: receiveInvoiceRef,
          notes: receiveNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(`Recepción procesada. Inventario y Costo Promedio (PPP) actualizados.`);
        setShowReceiveModal(false);
        fetchPurchaseOrders();
        fetchSuggestions();
        if (onRefreshInventory) onRefreshInventory();
      } else {
        showAlert(data.error || 'Error al procesar recepción', 'error');
      }
    } catch (err) {
      showAlert('Error al conectar con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Save Supplier (Create or Update)
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      showAlert('El nombre del proveedor es obligatorio', 'error');
      return;
    }

    setLoading(true);
    try {
      const url = editingSupplierId 
        ? `/api/inventory/suppliers/${editingSupplierId}`
        : '/api/inventory/suppliers';
      const method = editingSupplierId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(editingSupplierId ? 'Proveedor actualizado' : 'Proveedor creado exitosamente');
        setShowSupplierModal(false);
        setEditingSupplierId(null);
        fetchSuppliers();
      } else {
        showAlert(data.error || 'Error al guardar proveedor', 'error');
      }
    } catch (err) {
      showAlert('Error al procesar la solicitud', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Cancel Purchase Order
  const handleCancelPO = async (poId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta orden de compra?')) return;

    try {
      const res = await fetch(`/api/inventory/purchase-orders/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        showAlert('Orden de compra cancelada');
        fetchPurchaseOrders();
      }
    } catch (err) {
      showAlert('Error al cancelar la orden', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alertMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border shadow-lg ${
          alertMessage.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
            : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
        }`}>
          {alertMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-semibold">{alertMessage.text}</span>
        </div>
      )}

      {/* Header & Sub-Navigation */}
      <div className="glass-panel border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Gestión de Compras & Reabastecimiento</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Punto de Reorden (Auto-PO), Par Levels, Órdenes de Compra y Directorio de Proveedores
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setSubTab('suggestions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'suggestions'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Sugerido Auto-PO</span>
            {suggestions.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                subTab === 'suggestions' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {suggestions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab('orders')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'orders'
                ? 'bg-brand-primary text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Órdenes de Compra (OC)</span>
            {purchaseOrders.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                subTab === 'orders' ? 'bg-slate-950 text-brand-primary' : 'bg-slate-800 text-slate-300'
              }`}>
                {purchaseOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab('suppliers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'suppliers'
                ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Directorio de Proveedores</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              subTab === 'suppliers' ? 'bg-slate-950 text-sky-400' : 'bg-slate-800 text-slate-300'
            }`}>
              {suppliers.length}
            </span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: SUGERIDO INTELIGENTE (AUTO-PO) */}
      {subTab === 'suggestions' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-panel border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-400">Insumos Bajo Punto de Reorden</span>
              <div className="text-2xl font-black text-amber-400 mt-1 flex items-baseline gap-2">
                {suggestions.length}
                <span className="text-xs font-normal text-slate-500">requieren pedido</span>
              </div>
            </div>

            <div className="glass-panel border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-400">Inversión Estimada Sugerida</span>
              <div className="text-2xl font-black text-white mt-1">
                ${Object.entries(selectedSuggestions)
                  .filter(([_, v]) => v.selected)
                  .reduce((sum, [_, v]) => sum + (v.quantity * v.unitCost), 0)
                  .toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="glass-panel border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-400">Proveedores Involucrados</span>
              <div className="text-2xl font-black text-sky-400 mt-1">
                {new Set(
                  Object.entries(selectedSuggestions)
                    .filter(([_, v]) => v.selected && v.supplierId)
                    .map(([_, v]) => v.supplierId)
                ).size}
              </div>
            </div>

            <div className="glass-panel border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex flex-col justify-center">
              <button
                onClick={handleGenerateAutoPOs}
                disabled={loading || suggestions.length === 0}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Generar Auto-POs (1 Clic)</span>
              </button>
            </div>
          </div>

          {/* Suggestions List */}
          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  Insumos con Déficit de Par Level
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculado automáticamente: Insumos con stock &le; punto de reorden para reponer hasta el Par Level óptimo.
                </p>
              </div>

              <button
                onClick={fetchSuggestions}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Recalcular sugerencias"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {suggestions.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
                <h4 className="text-base font-bold text-white">Inventario en Niveles Óptimos</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Ningún insumo se encuentra por debajo de su punto de reorden. Tu cocina opera con suficiente stock de seguridad.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={suggestions.every((s) => selectedSuggestions[s.ingredientId]?.selected)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedSuggestions((prev) => {
                              const updated = { ...prev };
                              suggestions.forEach((s) => {
                                if (updated[s.ingredientId]) {
                                  updated[s.ingredientId].selected = checked;
                                }
                              });
                              return updated;
                            });
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Insumo</th>
                      <th className="p-4">Stock Actual</th>
                      <th className="p-4">Pto. Reorden / Par</th>
                      <th className="p-4">Cant. Sugerida</th>
                      <th className="p-4">Proveedor Asignado</th>
                      <th className="p-4">Costo Unit. Pactado</th>
                      <th className="p-4">Total Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {suggestions.map((s) => {
                      const sel = selectedSuggestions[s.ingredientId] || {
                        selected: false,
                        quantity: s.suggestedQty,
                        supplierId: s.preferredSupplier?.id || '',
                        unitCost: s.estimatedUnitCost,
                      };

                      return (
                        <tr
                          key={s.ingredientId}
                          className={`hover:bg-slate-800/30 transition-colors ${
                            sel.selected ? 'bg-amber-950/10' : 'opacity-60'
                          }`}
                        >
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={sel.selected}
                              onChange={(e) => {
                                setSelectedSuggestions((prev) => ({
                                  ...prev,
                                  [s.ingredientId]: {
                                    ...sel,
                                    selected: e.target.checked,
                                  },
                                }));
                              }}
                              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-white text-sm block">{s.ingredientName}</span>
                            <span className="text-[11px] text-slate-500">Unidad: {s.unit}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-black text-rose-400 bg-rose-950/40 border border-rose-800/60 px-2 py-0.5 rounded-md">
                              {s.currentStock.toFixed(2)} {s.unit}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-400 font-semibold">{s.reorderPoint}</span>
                              <span className="text-slate-600">/</span>
                              <span className="text-emerald-400 font-semibold">{s.parLevel} {s.unit}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">Reorden / Par</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={sel.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setSelectedSuggestions((prev) => ({
                                    ...prev,
                                    [s.ingredientId]: { ...sel, quantity: val },
                                  }));
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white text-right focus:border-amber-400 focus:outline-none"
                              />
                              <span className="text-slate-400 text-xs font-semibold">{s.unit}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {s.availableSuppliers.length > 0 ? (
                              <select
                                value={sel.supplierId}
                                onChange={(e) => {
                                  const supId = e.target.value;
                                  const matched = s.availableSuppliers.find((sup) => sup.id === supId);
                                  setSelectedSuggestions((prev) => ({
                                    ...prev,
                                    [s.ingredientId]: {
                                      ...sel,
                                      supplierId: supId,
                                      unitCost: matched ? matched.negotiatedCost : sel.unitCost,
                                    },
                                  }));
                                }}
                                className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:border-amber-400 focus:outline-none max-w-[200px]"
                              >
                                {s.availableSuppliers.map((sup) => (
                                  <option key={sup.id} value={sup.id}>
                                    {sup.name} (${sup.negotiatedCost.toFixed(2)}) {sup.isPreferred ? '⭐ Preferido' : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-rose-400 font-semibold italic flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Sin proveedor asignado
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            ${sel.unitCost.toFixed(2)}
                          </td>
                          <td className="p-4 font-mono font-bold text-amber-300">
                            ${(sel.quantity * sel.unitCost).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LISTA DE ÓRDENES DE COMPRA (OC) */}
      {subTab === 'orders' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por folio o remisión..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-brand-primary focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-primary focus:outline-none"
                >
                  <option value="ALL">Todos los estatus</option>
                  <option value="DRAFT">Borradores</option>
                  <option value="ORDERED">Enviadas / Ordenadas</option>
                  <option value="PARTIALLY_RECEIVED">Recibidas Parciales</option>
                  <option value="RECEIVED">Recibidas Completas</option>
                  <option value="CANCELLED">Canceladas</option>
                </select>
              </div>

              {/* Supplier Filter */}
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-primary focus:outline-none"
              >
                <option value="ALL">Todos los proveedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowNewPOModal(true)}
              className="w-full md:w-auto px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Orden de Compra</span>
            </button>
          </div>

          {/* Orders Table */}
          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {purchaseOrders.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-60" />
                <h4 className="text-base font-bold text-white">No hay órdenes de compra registradas</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Crea una orden manual o genera pedidos automáticos desde la pestaña de Sugerido Auto-PO.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-4">Folio</th>
                      <th className="p-4">Proveedor</th>
                      <th className="p-4">Fecha Creación</th>
                      <th className="p-4">Entrega Estimada</th>
                      <th className="p-4">Estatus</th>
                      <th className="p-4">Progreso Recepción</th>
                      <th className="p-4">Total ($)</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {purchaseOrders.map((po) => {
                      const totalOrdered = po.items.reduce((s, it) => s + it.quantityOrdered, 0);
                      const totalReceived = po.items.reduce((s, it) => s + it.quantityReceived, 0);
                      const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

                      let statusBadge = (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-300">
                          {po.status}
                        </span>
                      );

                      if (po.status === 'ORDERED') {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-sky-950/80 border border-sky-800 text-sky-400 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Ordenada
                          </span>
                        );
                      } else if (po.status === 'PARTIALLY_RECEIVED') {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center gap-1 w-fit">
                            <Truck className="w-3 h-3" /> Parcial ({pct}%)
                          </span>
                        );
                      } else if (po.status === 'RECEIVED') {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Recibida
                          </span>
                        );
                      } else if (po.status === 'CANCELLED') {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3" /> Cancelada
                          </span>
                        );
                      }

                      return (
                        <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <span className="font-mono font-black text-brand-primary text-sm block">{po.folio}</span>
                            {po.invoiceRef && (
                              <span className="text-[10px] text-slate-500 font-mono">Rem: {po.invoiceRef}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-white text-sm block">{po.supplier.name}</span>
                            <span className="text-[11px] text-slate-400">{po.paymentTerms || 'Contado'}</span>
                          </td>
                          <td className="p-4 text-slate-400">
                            {new Date(po.createdAt).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-4 text-slate-300">
                            {po.expectedDate ? (
                              <div className="flex items-center gap-1 text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                {new Date(po.expectedDate).toLocaleDateString('es-MX', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-4">{statusBadge}</td>
                          <td className="p-4">
                            <div className="w-32 space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>{totalReceived.toFixed(1)} / {totalOrdered.toFixed(1)}</span>
                                <span className="font-bold">{pct}%</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    pct === 100 ? 'bg-emerald-400' : pct > 0 ? 'bg-amber-400' : 'bg-slate-700'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-black text-white text-sm">
                            ${po.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                                <button
                                  onClick={() => openReceiveModal(po)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-md cursor-pointer"
                                  title="Recibir mercancía"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  <span>Recibir</span>
                                </button>
                              )}

                              {po.status === 'ORDERED' && (
                                <button
                                  onClick={() => handleCancelPO(po.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                  title="Cancelar orden"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DIRECTORIO DE PROVEEDORES */}
      {subTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white">Directorio de Proveedores y Precios Pactados</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Catálogo de proveedores acreditados, plazos de crédito y costos acordados por insumo.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSupplierId(null);
                setSupplierForm({
                  name: '',
                  code: '',
                  contactName: '',
                  email: '',
                  phone: '',
                  taxId: '',
                  address: '',
                  paymentTerms: 'CONTADO',
                  leadTimeDays: 1,
                  notes: '',
                  ingredientCosts: [],
                });
                setShowSupplierModal(true);
              }}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="glass-panel border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{sup.name}</h4>
                      {sup.code && <span className="text-[11px] font-mono text-sky-400 font-semibold">{sup.code}</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      sup.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {sup.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    {sup.contactName && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="font-semibold text-slate-500">Contacto:</span> {sup.contactName}
                      </div>
                    )}
                    {sup.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="font-semibold text-slate-500">Teléfono:</span> {sup.phone}
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="font-semibold text-slate-500">Email:</span> {sup.email}
                      </div>
                    )}
                    {sup.taxId && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="font-semibold text-slate-500">RFC/TaxID:</span> <span className="font-mono">{sup.taxId}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
                      <span>Plazo: <strong className="text-white">{sup.paymentTerms || 'Contado'}</strong></span>
                      <span>•</span>
                      <span>Entrega: <strong className="text-white">{sup.leadTimeDays || 1} días</strong></span>
                    </div>
                  </div>

                  {/* Negotiated Ingredients Tag Summary */}
                  {sup.ingredients && sup.ingredients.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
                        Insumos Pactados ({sup.ingredients.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {sup.ingredients.map((rel) => (
                          <span
                            key={rel.id}
                            className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 flex items-center gap-1"
                          >
                            <span>{rel.ingredient.name}</span>
                            <span className="text-emerald-400 font-mono font-bold">${rel.negotiatedCost.toFixed(2)}</span>
                            {rel.isPreferred && <span title="Proveedor preferido">⭐</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {sup._count?.purchaseOrders || 0} órdenes históricas
                  </span>
                  <button
                    onClick={() => {
                      setEditingSupplierId(sup.id);
                      setSupplierForm({
                        name: sup.name,
                        code: sup.code || '',
                        contactName: sup.contactName || '',
                        email: sup.email || '',
                        phone: sup.phone || '',
                        taxId: sup.taxId || '',
                        address: sup.address || '',
                        paymentTerms: sup.paymentTerms || 'CONTADO',
                        leadTimeDays: sup.leadTimeDays || 1,
                        notes: sup.notes || '',
                        ingredientCosts: (sup.ingredients || []).map((rel) => ({
                          ingredientId: rel.ingredientId,
                          negotiatedCost: rel.negotiatedCost,
                          supplierSku: rel.supplierSku || '',
                          isPreferred: rel.isPreferred,
                          minOrderQty: rel.minOrderQty || 1,
                        })),
                      });
                      setShowSupplierModal(true);
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 font-bold cursor-pointer"
                  >
                    Editar / Tarifas &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NUEVA ORDEN DE COMPRA MANUAL */}
      {showNewPOModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-brand-primary" />
                  Nueva Orden de Compra (OC)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Emite una requisición oficial de compra a un proveedor.</p>
              </div>
              <button
                onClick={() => setShowNewPOModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateManualPO} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Proveedor *</label>
                  <select
                    value={newPOSupplierId}
                    onChange={(e) => {
                      const supId = e.target.value;
                      setNewPOSupplierId(supId);
                      const s = suppliers.find((x) => x.id === supId);
                      if (s?.paymentTerms) setNewPOPaymentTerms(s.paymentTerms);
                    }}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                  >
                    <option value="">Selecciona un proveedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.paymentTerms || 'Contado'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Fecha Estimada de Entrega</label>
                  <input
                    type="date"
                    value={newPOExpectedDate}
                    onChange={(e) => setNewPOExpectedDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Términos de Pago</label>
                  <select
                    value={newPOPaymentTerms}
                    onChange={(e) => setNewPOPaymentTerms(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                  >
                    <option value="CONTADO">Contado / Pago Inmediato</option>
                    <option value="CREDITO_15">Crédito 15 días</option>
                    <option value="CREDITO_30">Crédito 30 días</option>
                    <option value="CREDITO_60">Crédito 60 días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tasa de Impuesto (IVA)</label>
                  <select
                    value={newPOTaxRate}
                    onChange={(e) => setNewPOTaxRate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                  >
                    <option value="0.16">16% IVA General</option>
                    <option value="0.08">8% IVA Fronterizo</option>
                    <option value="0">0% Tasa Cero / Exento</option>
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">Insumos Solicitados</label>
                  <button
                    type="button"
                    onClick={() => setNewPOItems([...newPOItems, { ingredientId: '', quantityOrdered: 1, unitCost: 0 }])}
                    className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Insumo
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {newPOItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => {
                          const ingId = e.target.value;
                          const selectedSup = suppliers.find((s) => s.id === newPOSupplierId);
                          const neg = selectedSup?.ingredients?.find((i) => i.ingredientId === ingId);
                          const defaultCost = neg ? neg.negotiatedCost : (availableIngredients.find((x) => x.id === ingId)?.cost || 0);

                          const updated = [...newPOItems];
                          updated[idx] = {
                            ...updated[idx],
                            ingredientId: ingId,
                            unitCost: defaultCost,
                          };
                          setNewPOItems(updated);
                        }}
                        required
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-brand-primary focus:outline-none"
                      >
                        <option value="">Selecciona insumo</option>
                        {availableIngredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit}) - Stock: {ing.stock.toFixed(2)}
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Cant."
                          value={item.quantityOrdered}
                          onChange={(e) => {
                            const updated = [...newPOItems];
                            updated[idx].quantityOrdered = parseFloat(e.target.value) || 0;
                            setNewPOItems(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white text-right focus:border-brand-primary focus:outline-none"
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Costo U."
                          value={item.unitCost}
                          onChange={(e) => {
                            const updated = [...newPOItems];
                            updated[idx].unitCost = parseFloat(e.target.value) || 0;
                            setNewPOItems(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white text-right focus:border-brand-primary focus:outline-none"
                        />
                      </div>

                      <div className="w-24 font-mono font-bold text-xs text-white text-right">
                        ${(item.quantityOrdered * item.unitCost).toFixed(2)}
                      </div>

                      {newPOItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewPOItems(newPOItems.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">${newPOItems.reduce((acc, it) => acc + (it.quantityOrdered * it.unitCost), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Impuesto ({parseFloat(newPOTaxRate) * 100}%):</span>
                  <span className="font-mono">
                    ${(newPOItems.reduce((acc, it) => acc + (it.quantityOrdered * it.unitCost), 0) * parseFloat(newPOTaxRate)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-slate-800">
                  <span>Total Orden:</span>
                  <span className="font-mono text-brand-primary">
                    ${(
                      newPOItems.reduce((acc, it) => acc + (it.quantityOrdered * it.unitCost), 0) * (1 + parseFloat(newPOTaxRate))
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Instrucciones o Notas</label>
                <textarea
                  value={newPONotes}
                  onChange={(e) => setNewPONotes(e.target.value)}
                  placeholder="Ej. Entregar antes de las 11:00 AM por la puerta trasera de carga..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPOModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Crear y Emitir Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEPCIÓN DE MERCANCÍA (CON RECÁLCULO PPP) */}
      {showReceiveModal && selectedPOForReceive && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  Recepción de Mercancía: {selectedPOForReceive.folio}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proveedor: <strong className="text-white">{selectedPOForReceive.supplier.name}</strong> • El stock y Precio Promedio Ponderado (PPP) se recalcularán automáticamente.
                </p>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">No. de Remisión o Factura *</label>
                <input
                  type="text"
                  placeholder="Ej. REM-48291 o F-9902"
                  value={receiveInvoiceRef}
                  onChange={(e) => setReceiveInvoiceRef(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notas de Inspección / Calidad</label>
                <input
                  type="text"
                  placeholder="Ej. Caducidad adecuada, empaques íntegros..."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                Verificación de Cantidades Recibidas
              </label>

              <div className="space-y-2.5">
                {selectedPOForReceive.items.map((item) => {
                  const inputVal = receivedItemInputs[item.id] || { quantityReceived: 0, unitCost: item.unitCost };
                  const pending = Math.max(0, item.quantityOrdered - item.quantityReceived);

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-white text-sm block">{item.ingredient.name}</span>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3">
                          <span>Ordenado: <strong>{item.quantityOrdered} {item.ingredient.unit}</strong></span>
                          <span>Ya Recibido: <strong>{item.quantityReceived} {item.ingredient.unit}</strong></span>
                          <span>Pendiente: <strong className="text-amber-400">{pending} {item.ingredient.unit}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Cant. a Recibir</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={pending}
                              value={inputVal.quantityReceived}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setReceivedItemInputs((prev) => ({
                                  ...prev,
                                  [item.id]: { ...inputVal, quantityReceived: val },
                                }));
                              }}
                              className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white text-right focus:border-emerald-400 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400">{item.ingredient.unit}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Costo Unit. Real ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={inputVal.unitCost}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReceivedItemInputs((prev) => ({
                                ...prev,
                                [item.id]: { ...inputVal, unitCost: val },
                              }));
                            }}
                            className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white text-right focus:border-emerald-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer flex items-center gap-2"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Confirmar Entrada al Almacén</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALTA / EDICIÓN DE PROVEEDOR & PRECIOS PACTADOS */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-400" />
                  {editingSupplierId ? 'Editar Proveedor y Precios' : 'Registrar Nuevo Proveedor'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Configura datos fiscales, tiempos de entrega y tarifas pactadas por insumo.</p>
              </div>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Razón Social / Nombre Comercial *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carnes Selectas del Norte"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Código Interno</label>
                  <input
                    type="text"
                    placeholder="Ej. PROV-001"
                    value={supplierForm.code}
                    onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Contacto Principal</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ej. +52 55 1234 5678"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="pedidos@proveedor.com"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">RFC / Identificación Fiscal</label>
                  <input
                    type="text"
                    placeholder="CSN890101XYZ"
                    value={supplierForm.taxId}
                    onChange={(e) => setSupplierForm({ ...supplierForm, taxId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Plazo de Pago</label>
                  <select
                    value={supplierForm.paymentTerms}
                    onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  >
                    <option value="CONTADO">Contado</option>
                    <option value="CREDITO_15">Crédito 15 días</option>
                    <option value="CREDITO_30">Crédito 30 días</option>
                    <option value="CREDITO_60">Crédito 60 días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Lead Time (Días Entrega)</label>
                  <input
                    type="number"
                    min="1"
                    value={supplierForm.leadTimeDays}
                    onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Insumos Pactados Section */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold text-white uppercase tracking-wider block">Catálogo de Insumos & Tarifas Pactadas</label>
                    <p className="text-[11px] text-slate-500">Define los insumos que provee y el precio acordado para sugeridos y órdenes.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierForm({
                        ...supplierForm,
                        ingredientCosts: [
                          ...supplierForm.ingredientCosts,
                          { ingredientId: '', negotiatedCost: 0, supplierSku: '', isPreferred: false, minOrderQty: 1 },
                        ],
                      });
                    }}
                    className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Insumo
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {supplierForm.ingredientCosts.map((rel, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <select
                        value={rel.ingredientId}
                        onChange={(e) => {
                          const updated = [...supplierForm.ingredientCosts];
                          updated[idx].ingredientId = e.target.value;
                          setSupplierForm({ ...supplierForm, ingredientCosts: updated });
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                      >
                        <option value="">Selecciona insumo</option>
                        {availableIngredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>

                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Precio Pactado $"
                          value={rel.negotiatedCost}
                          onChange={(e) => {
                            const updated = [...supplierForm.ingredientCosts];
                            updated[idx].negotiatedCost = parseFloat(e.target.value) || 0;
                            setSupplierForm({ ...supplierForm, ingredientCosts: updated });
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white text-right focus:border-sky-400 focus:outline-none"
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="text"
                          placeholder="SKU Prov."
                          value={rel.supplierSku}
                          onChange={(e) => {
                            const updated = [...supplierForm.ingredientCosts];
                            updated[idx].supplierSku = e.target.value;
                            setSupplierForm({ ...supplierForm, ingredientCosts: updated });
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rel.isPreferred}
                          onChange={(e) => {
                            const updated = [...supplierForm.ingredientCosts];
                            updated[idx].isPreferred = e.target.checked;
                            setSupplierForm({ ...supplierForm, ingredientCosts: updated });
                          }}
                          className="rounded bg-slate-950 border-slate-700 text-sky-400"
                        />
                        <span>Preferido</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = supplierForm.ingredientCosts.filter((_, i) => i !== idx);
                          setSupplierForm({ ...supplierForm, ingredientCosts: updated });
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
