'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  UtensilsCrossed, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Layers, 
  Store, 
  CheckCircle2, 
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  _count?: {
    products: number;
  };
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId: string;
  category?: Category;
  isActive: boolean;
  recipeItems?: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
  }>;
}

interface BrandItem {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
  isActive: boolean;
}

export default function MenuManagementPage() {
  const [activeTab, setActiveTab] = useState<'dishes' | 'categories' | 'brands'>('dishes');
  const [loading, setLoading] = useState(true);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodCatId, setProdCatId] = useState('');
  const [prodImgUrl, setProdImgUrl] = useState('');
  const [prodIsActive, setProdIsActive] = useState(true);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');

  // Brand Modal State
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);
  const [brandName, setBrandName] = useState('');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#F59E0B');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#1E293B');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const { activeBrand, addNotification } = useAppStore();

  const COLOR_PRESETS = [
    { name: 'Ámbar / Naranja', hex: '#F59E0B' },
    { name: 'Esmeralda / Verde', hex: '#10B981' },
    { name: 'Rojo Carmesí', hex: '#EF4444' },
    { name: 'Púrpura Neón', hex: '#8B5CF6' },
    { name: 'Azul Eléctrico', hex: '#3B82F6' },
    { name: 'Rosa Vibrante', hex: '#EC4899' },
    { name: 'Cian Moderno', hex: '#06B6D4' },
  ];

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch all products (including inactive ones)
      const prodRes = await fetch('/api/products?all=true');
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }

      // 2. Fetch categories
      const catRes = await fetch('/api/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }

      // 3. Fetch brands
      const brandsRes = await fetch('/api/brands');
      if (brandsRes.ok) {
        const brandsData = await brandsRes.json();
        setBrands(brandsData.brands || []);
      }
    } catch (err) {
      console.error('Failed to load menu management data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Product Actions
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdDesc('');
    setProdPrice(0);
    setProdCatId(categories[0]?.id || '');
    setProdImgUrl('');
    setProdIsActive(true);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdDesc(prod.description || '');
    setProdPrice(prod.price);
    setProdCatId(prod.categoryId);
    setProdImgUrl(prod.imageUrl || '');
    setProdIsActive(prod.isActive);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodCatId || prodPrice < 0) return;

    setSaving(true);
    try {
      if (editingProduct) {
        // Edit product
        const res = await fetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingProduct.id,
            name: prodName,
            description: prodDesc,
            price: prodPrice,
            categoryId: prodCatId,
            imageUrl: prodImgUrl,
            isActive: prodIsActive,
          }),
        });

        if (res.ok) {
          addNotification(`Platillo ${prodName} actualizado`, 'success');
          setIsProductModalOpen(false);
          fetchAllData();
        } else {
          const data = await res.json();
          alert(`Error: ${data.error}`);
        }
      } else {
        // Create product
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: prodName,
            description: prodDesc,
            price: prodPrice,
            categoryId: prodCatId,
            imageUrl: prodImgUrl,
            isActive: prodIsActive,
          }),
        });

        if (res.ok) {
          addNotification(`Platillo ${prodName} creado con éxito`, 'success');
          setIsProductModalOpen(false);
          fetchAllData();
        } else {
          const data = await res.json();
          alert(`Error: ${data.error}`);
        }
      }
    } catch {
      alert('Error de red al guardar platillo');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductActive = async (prod: Product) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prod.id,
          isActive: !prod.isActive,
        }),
      });

      if (res.ok) {
        addNotification(
          `${prod.name} ahora está ${!prod.isActive ? 'Disponible en POS' : 'Agotado / Oculto'}`,
          !prod.isActive ? 'success' : 'warning'
        );
        fetchAllData();
      }
    } catch {
      alert('Error al cambiar disponibilidad');
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (!confirm(`¿Estás seguro de eliminar el platillo "${prod.name}"?`)) return;

    try {
      const res = await fetch(`/api/products?id=${prod.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addNotification(`Platillo "${prod.name}" eliminado`, 'info');
        fetchAllData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red al eliminar platillo');
    }
  };

  // Category Actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || catName.trim().length === 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName }),
      });

      if (res.ok) {
        addNotification(`Categoría "${catName}" agregada`, 'success');
        setCatName('');
        setIsCategoryModalOpen(false);
        fetchAllData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al crear categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/categories?id=${cat.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addNotification(`Categoría "${cat.name}" eliminada`, 'info');
        fetchAllData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error al eliminar categoría');
    }
  };

  // Brand Actions
  const handleOpenNewBrand = () => {
    setEditingBrand(null);
    setBrandName('');
    setBrandPrimaryColor('#F59E0B');
    setBrandSecondaryColor('#1E293B');
    setBrandLogoUrl('');
    setIsBrandModalOpen(true);
  };

  const handleOpenEditBrand = (b: BrandItem) => {
    setEditingBrand(b);
    setBrandName(b.name);
    setBrandPrimaryColor(b.primaryColor);
    setBrandSecondaryColor(b.secondaryColor);
    setBrandLogoUrl(b.logoUrl || '');
    setIsBrandModalOpen(true);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName || brandName.trim().length === 0) return;

    setSaving(true);
    try {
      if (editingBrand) {
        const res = await fetch('/api/brands', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingBrand.id,
            name: brandName,
            primaryColor: brandPrimaryColor,
            secondaryColor: brandSecondaryColor,
            logoUrl: brandLogoUrl,
          }),
        });

        if (res.ok) {
          addNotification(`Marca "${brandName}" actualizada`, 'success');
          setIsBrandModalOpen(false);
          fetchAllData();
        } else {
          const data = await res.json();
          alert(`Error: ${data.error}`);
        }
      } else {
        const res = await fetch('/api/brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: brandName,
            primaryColor: brandPrimaryColor,
            secondaryColor: brandSecondaryColor,
            logoUrl: brandLogoUrl,
          }),
        });

        if (res.ok) {
          addNotification(`Nueva marca "${brandName}" creada exitosamente`, 'success');
          setIsBrandModalOpen(false);
          fetchAllData();
        } else {
          const data = await res.json();
          alert(`Error: ${data.error}`);
        }
      }
    } catch {
      alert('Error al guardar marca');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCatFilter === 'all' || p.categoryId === selectedCatFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando catálogo y marcas...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Menú & Catálogo Digital</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Administración de platillos, secciones y marcas de la cocina fantasma activa: <strong className="text-white">{activeBrand?.name}</strong>
              </p>
            </div>
          </div>

          {/* Quick Action Button depending on tab */}
          {activeTab === 'dishes' && (
            <button
              onClick={handleOpenNewProduct}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer transition-all duration-200"
            >
              <Plus className="h-4 w-4 stroke-[3px]" /> Nuevo Platillo
            </button>
          )}
          {activeTab === 'categories' && (
            <button
              onClick={() => { setCatName(''); setIsCategoryModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer transition-all duration-200"
            >
              <Plus className="h-4 w-4 stroke-[3px]" /> Nueva Categoría
            </button>
          )}
          {activeTab === 'brands' && (
            <button
              onClick={handleOpenNewBrand}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer transition-all duration-200"
            >
              <Sparkles className="h-4 w-4" /> Crear Nueva Marca
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 gap-6 text-sm shrink-0">
          <button
            onClick={() => setActiveTab('dishes')}
            className={`pb-3 font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'dishes' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" /> Platillos ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'categories' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" /> Categorías ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('brands')}
            className={`pb-3 font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'brands' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Store className="h-4 w-4" /> Marcas de Cocina ({brands.length})
          </button>
        </div>

        {/* TAB 1: DISHES */}
        {activeTab === 'dishes' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en el catálogo por nombre o descripción..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex overflow-x-auto gap-2 py-1 max-w-full">
                <button
                  onClick={() => setSelectedCatFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border shrink-0 transition-all cursor-pointer ${
                    selectedCatFilter === 'all'
                      ? 'bg-brand-primary border-brand-primary text-slate-950 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter(p => p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCatFilter(cat.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border shrink-0 transition-all cursor-pointer ${
                        selectedCatFilter === cat.id
                          ? 'bg-brand-primary border-brand-primary text-slate-950 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center glass-panel border border-slate-800 rounded-xl space-y-3">
                <UtensilsCrossed className="h-10 w-10 mx-auto text-slate-600" />
                <h4 className="font-bold text-white text-base">No hay platillos registrados</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Aún no has agregado platillos para esta cocina o ningún platillo coincide con la búsqueda.
                </p>
                <button
                  onClick={handleOpenNewProduct}
                  className="px-4 py-2 bg-brand-primary text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3px]" /> Crear Primer Platillo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((prod) => (
                  <div 
                    key={prod.id}
                    className={`glass-panel border rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 ${
                      prod.isActive ? 'border-slate-800' : 'border-red-950/40 opacity-75 bg-red-950/5'
                    }`}
                  >
                    <div>
                      {/* Product Image Header */}
                      <div className="h-36 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
                        {prod.imageUrl ? (
                          <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                            <UtensilsCrossed className="h-8 w-8" />
                            <span className="text-[10px]">Sin imagen</span>
                          </div>
                        )}
                        <span className="absolute top-2.5 right-2.5 bg-slate-950/80 backdrop-blur-md font-black text-brand-primary text-xs px-2.5 py-1 rounded-md border border-slate-800 shadow">
                          ${prod.price.toFixed(2)}
                        </span>
                        <span className="absolute bottom-2.5 left-2.5 bg-slate-900/90 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-700/60">
                          {prod.category?.name || 'General'}
                        </span>
                      </div>

                      {/* Info Body */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-white text-sm truncate leading-snug">{prod.name}</h4>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">
                          {prod.description || 'Sin descripción detallada.'}
                        </p>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-3 border-t border-slate-850 bg-slate-900/40 flex items-center justify-between text-xs">
                      {/* Active / Inactive Status Toggle */}
                      <button
                        onClick={() => handleToggleProductActive(prod)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          prod.isActive
                            ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/40'
                            : 'bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-900/40'
                        }`}
                        title={prod.isActive ? 'Desactivar platillo' : 'Activar platillo'}
                      >
                        {prod.isActive ? (
                          <>
                            <Eye className="h-3 w-3" /> En Venta
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3" /> Agotado
                          </>
                        )}
                      </button>

                      {/* Edit & Delete Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                          title="Editar Platillo"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod)}
                          className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 border border-transparent hover:border-red-900/50 rounded transition-colors cursor-pointer"
                          title="Eliminar Platillo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 glass-panel border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                <h4 className="font-bold text-white text-sm">Categorías de la Cocina</h4>
                <span className="text-xs text-slate-500 font-semibold">{categories.length} Secciones</span>
              </div>

              <div className="divide-y divide-slate-800">
                {categories.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">No hay categorías creadas aún.</div>
                ) : (
                  categories.map((cat) => {
                    const prodCount = products.filter(p => p.categoryId === cat.id).length;
                    return (
                      <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-slate-900/30 transition-colors">
                        <div className="space-y-0.5">
                          <p className="font-bold text-white text-sm">{cat.name}</p>
                          <p className="text-[10px] text-slate-500">{prodCount} platillo(s) en esta sección</p>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-red-400 hover:text-red-300 p-2 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Categoría"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Add Category Card */}
            <div className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 h-fit">
              <div className="border-b border-slate-850 pb-2 flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-primary" />
                <h4 className="font-bold text-white text-sm">Añadir Categoría</h4>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre de la Categoría *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hamburguesas Gourmet, Bebidas, Postres"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Crear Categoría'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: BRANDS */}
        {activeTab === 'brands' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {brands.map((b) => {
                const isCurrentActive = activeBrand?.id === b.id;
                return (
                  <div
                    key={b.id}
                    className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 relative overflow-hidden"
                    style={{ borderTop: `4px solid ${b.primaryColor}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {b.logoUrl ? (
                          <img src={b.logoUrl} alt={b.name} className="h-10 w-10 rounded-full object-cover border border-slate-700" />
                        ) : (
                          <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-slate-950 text-sm" style={{ backgroundColor: b.primaryColor }}>
                            {b.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-white text-base leading-tight">{b.name}</h4>
                          <span className="text-[10px] text-slate-500 font-mono">/{b.slug}</span>
                        </div>
                      </div>

                      {isCurrentActive && (
                        <span className="bg-emerald-950/60 border border-emerald-900 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Cocina Activa
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-850">
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Color Primario</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: b.primaryColor }} />
                          <span className="font-mono text-slate-300">{b.primaryColor}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Estado</span>
                        <p className="font-bold text-slate-200 mt-1 flex items-center gap-1">
                          {b.isActive ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                          {b.isActive ? 'Operando' : 'Pausada'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => handleOpenEditBrand(b)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 cursor-pointer transition-colors"
                      >
                        Configurar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODAL: PRODUCT CREATE / EDIT */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-white">
                  {editingProduct ? `Editar Platillo: ${editingProduct.name}` : 'Dar de Alta Nuevo Platillo'}
                </h3>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre del Platillo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hamburguesa Doble Bacon BBQ"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Categoría / Sección *</label>
                    <select
                      required
                      value={prodCatId}
                      onChange={(e) => setProdCatId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    >
                      <option value="">-- Seleccionar --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Precio de Venta ($) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="149.00"
                      value={prodPrice || ''}
                      onChange={(e) => setProdPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Descripción / Ingredientes visibles</label>
                  <textarea
                    rows={2}
                    placeholder="Carne de res 180g, queso cheddar, tocino ahumado..."
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">URL de Imagen (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={prodImgUrl}
                    onChange={(e) => setProdImgUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="prodActive"
                    checked={prodIsActive}
                    onChange={(e) => setProdIsActive(e.target.checked)}
                    className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="prodActive" className="text-slate-300 font-semibold cursor-pointer">
                    Habilitar para venta inmediata en POS y Apps
                  </label>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingProduct ? 'Actualizar Platillo' : 'Crear Platillo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CATEGORY CREATE */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-white">Nueva Sección del Menú</h3>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre de la Categoría *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Tacos Especiales"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BRAND CREATE / EDIT */}
        {isBrandModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsBrandModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                <Store className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-white">
                  {editingBrand ? `Configurar Marca: ${editingBrand.name}` : 'Crear Nueva Marca Virtual'}
                </h3>
              </div>

              <form onSubmit={handleSaveBrand} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">Nombre de la Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pizza Vault, Wok Master"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-400">Color Corporativo Primario</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        type="button"
                        key={preset.hex}
                        onClick={() => setBrandPrimaryColor(preset.hex)}
                        className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                          brandPrimaryColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-white scale-110 shadow-lg'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                        title={preset.name}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="color"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      className="h-8 w-12 bg-transparent cursor-pointer rounded border border-slate-800"
                    />
                    <input
                      type="text"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      className="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-center outline-none focus:border-brand-primary"
                    />
                    <span className="text-[10px] text-slate-500">Color que tiñe los botones e indicadores</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400">URL del Logo (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={brandLogoUrl}
                    onChange={(e) => setBrandLogoUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsBrandModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingBrand ? 'Guardar Cambios' : 'Crear Marca'}
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
