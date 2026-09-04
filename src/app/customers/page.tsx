'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  Users, 
  Crown, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Clock, 
  ShoppingBag, 
  Sparkles, 
  Edit3, 
  Trash2, 
  X, 
  RefreshCw,
  TrendingUp,
  Coins
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
  };
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  source: string;
  createdAt: string;
  brand?: {
    name: string;
  };
  items: OrderItem[];
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name: string;
    primaryColor: string;
  } | null;
  orders: CustomerOrder[];
}

interface CRMStats {
  totalCustomers: number;
  vipCustomers: number;
  totalPoints: number;
  totalSpent: number;
  averageSpent: number;
}

export default function CustomersPage() {
  const { addNotification } = useAppStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CRMStats>({
    totalCustomers: 0,
    vipCustomers: 0,
    totalPoints: 0,
    totalSpent: 0,
    averageSpent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'vip' | 'recent'>('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [pointsAdjustment, setPointsAdjustment] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    initialPoints: 0,
  });

  const fetchCustomers = useCallback(async (search = searchQuery, filter = filterType) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (filter !== 'all') params.append('filter', filter);

      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar clientes');
      const data = await res.json();
      setCustomers(data.customers || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: unknown) {
      console.error(err);
      addNotification('Error al cargar datos de clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterType, addNotification]);

  useEffect(() => {
    fetchCustomers();
  }, [filterType, fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(searchQuery, filterType);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      addNotification('Nombre y teléfono son obligatorios', 'error');
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar cliente');
      }

      addNotification('Cliente registrado exitosamente', 'success');
      setShowCreateModal(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        initialPoints: 0,
      });
      fetchCustomers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      addNotification(msg, 'error');
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCustomer.id,
          name: editingCustomer.name,
          phone: editingCustomer.phone,
          email: editingCustomer.email,
          address: editingCustomer.address,
          notes: editingCustomer.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar cliente');
      }

      addNotification('Cliente actualizado exitosamente', 'success');
      setEditingCustomer(null);
      fetchCustomers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      addNotification(msg, 'error');
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedCustomerForHistory || pointsAdjustment === 0) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomerForHistory.id,
          pointsAdjustment,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al ajustar puntos');
      }

      addNotification(`Puntos actualizados correctamente (${pointsAdjustment > 0 ? '+' : ''}${pointsAdjustment} pts)`, 'success');
      setSelectedCustomerForHistory(data.customer);
      setPointsAdjustment(0);
      setAdjustmentReason('');
      fetchCustomers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      addNotification(msg, 'error');
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar al cliente "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/customers?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar cliente');
      }

      addNotification('Cliente eliminado correctamente', 'success');
      fetchCustomers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar cliente';
      addNotification(msg, 'error');
    }
  };

  return (
    <DashboardContainer>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Users className="h-8 w-8 text-amber-400" />
              Clientes & Fidelización CRM
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Gestiona tu base de clientes, historial de pedidos, preferencias y programa de puntos de lealtad.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
            Nuevo Cliente
          </button>
        </div>

        {/* Stats KPIs Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Clientes</p>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{stats.totalCustomers}</h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">Registrados en el sistema</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5" /> Clientes VIP (3+ Pedidos)
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{stats.vipCustomers}</h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">
                  {stats.totalCustomers > 0 
                    ? `${Math.round((stats.vipCustomers / stats.totalCustomers) * 100)}% de fidelidad` 
                    : '0% de fidelidad'}
                </span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Crown className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5" /> Puntos en Circulación
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-purple-400 mt-1">
                  {stats.totalPoints.toLocaleString()} pts
                </h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">1 pt por cada $10 gastados</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Ticket Promedio LTV
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                  ${stats.averageSpent.toFixed(2)}
                </h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">
                  Total LTV: ${stats.totalSpent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => { setFilterType('all'); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Todos ({stats.totalCustomers})
            </button>
            <button
              onClick={() => { setFilterType('vip'); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterType === 'vip'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Crown className="h-3.5 w-3.5" /> Clientes VIP ({stats.vipCustomers})
            </button>
            <button
              onClick={() => { setFilterType('recent'); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterType === 'recent'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Actividad Reciente
            </button>
            <button
              onClick={() => fetchCustomers()}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-auto md:ml-0"
              title="Refrescar lista"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-sm font-medium">Cargando base de clientes...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-12 text-center">
            <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No se encontraron clientes</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              {searchQuery 
                ? `No hay coincidencias para "${searchQuery}". Intenta con otro término de búsqueda.`
                : 'Aún no hay clientes registrados o que coincidan con el filtro seleccionado.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-400 transition-colors"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              Registrar Primer Cliente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {customers.map((customer) => {
              const isVIP = customer.totalOrders >= 3;
              return (
                <div
                  key={customer.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group relative"
                >
                  {/* Top Bar inside Card */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          isVIP 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                              {customer.name}
                            </h3>
                            {isVIP && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Crown className="h-2.5 w-2.5" /> VIP
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" /> {customer.phone}
                          </span>
                        </div>
                      </div>

                      {/* Loyalty Badge */}
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                          <Sparkles className="h-3 w-3 text-purple-400" />
                          <span>{customer.loyaltyPoints} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Details section */}
                    <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 rounded-xl p-3 mb-4">
                      {customer.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.address ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{customer.address}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-600 italic">
                          <MapPin className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                          <span>Sin dirección registrada</span>
                        </div>
                      )}
                      {customer.notes && (
                        <div className="flex items-start gap-2 text-amber-400/90 pt-1 border-t border-slate-800/80">
                          <FileText className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2 italic">{customer.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Stats & Actions */}
                  <div>
                    <div className="grid grid-cols-2 gap-2 text-center py-2.5 px-3 bg-slate-950 rounded-xl border border-slate-800/80 mb-4">
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Pedidos</p>
                        <p className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                          <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />
                          {customer.totalOrders}
                        </p>
                      </div>
                      <div className="border-l border-slate-800">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Total Gastado</p>
                        <p className="text-sm font-bold text-emerald-400 mt-0.5">
                          ${customer.totalSpent.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => setSelectedCustomerForHistory(customer)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        Historial & Puntos
                      </button>

                      <button
                        onClick={() => setEditingCustomer(customer)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                        title="Editar cliente"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                        className="p-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Customer */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Registrar Nuevo Cliente</h3>
                    <p className="text-xs text-slate-400">Crea el perfil del cliente en el CRM</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Mariana López"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Teléfono (Identificador único) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="ej. 5512345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="mariana@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Dirección Habitual de Entrega
                  </label>
                  <input
                    type="text"
                    placeholder="Calle, Número, Colonia, Referencias"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Notas / Preferencias del Cliente
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Alergias, ingredientes preferidos, indicaciones especiales..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Puntos Iniciales de Bienvenida
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.initialPoints}
                    onChange={(e) => setFormData({ ...formData, initialPoints: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
                  >
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Customer */}
        {editingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Edit3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Editar Perfil de Cliente</h3>
                    <p className="text-xs text-slate-400">{editingCustomer.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingCustomer(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCustomer} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={editingCustomer.phone}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={editingCustomer.email || ''}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Dirección Habitual de Entrega
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.address || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Notas / Preferencias
                  </label>
                  <textarea
                    rows={2}
                    value={editingCustomer.notes || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Order History & Manual Loyalty Points Adjustment */}
        {selectedCustomerForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-base">
                    {selectedCustomerForHistory.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{selectedCustomerForHistory.name}</h3>
                      {selectedCustomerForHistory.totalOrders >= 3 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          VIP
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span>Tel: {selectedCustomerForHistory.phone}</span>
                      <span>•</span>
                      <span>Total Gastado: ${selectedCustomerForHistory.totalSpent.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedCustomerForHistory(null); setPointsAdjustment(0); }}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Points Balance & Manual Adjustment Card */}
                <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div>
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" /> Saldo de Puntos de Lealtad
                      </span>
                      <h4 className="text-3xl font-black text-white mt-1">
                        {selectedCustomerForHistory.loyaltyPoints}{' '}
                        <span className="text-sm font-normal text-purple-300">Puntos</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Equivalente a <strong className="text-white">${(selectedCustomerForHistory.loyaltyPoints * 0.1).toFixed(2)} MXN</strong> en descuentos.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPointsAdjustment(50)}
                        className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/80 text-purple-300 text-xs font-bold hover:bg-purple-900 transition-colors"
                      >
                        +50 pts
                      </button>
                      <button
                        onClick={() => setPointsAdjustment(100)}
                        className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/80 text-purple-300 text-xs font-bold hover:bg-purple-900 transition-colors"
                      >
                        +100 pts
                      </button>
                      <button
                        onClick={() => setPointsAdjustment(-50)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                      >
                        -50 pts
                      </button>
                    </div>
                  </div>

                  {/* Manual adjustment input */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-purple-900/40">
                    <div className="w-full sm:w-48">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ajuste manual (+/-)</label>
                      <input
                        type="number"
                        placeholder="ej. +50 ó -20"
                        value={pointsAdjustment === 0 ? '' : pointsAdjustment}
                        onChange={(e) => setPointsAdjustment(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="w-full sm:flex-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Motivo (Opcional)</label>
                      <input
                        type="text"
                        placeholder="ej. Bonificación por cumpleaños o reclamo"
                        value={adjustmentReason}
                        onChange={(e) => setAdjustmentReason(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <button
                      onClick={handleAdjustPoints}
                      disabled={pointsAdjustment === 0}
                      className={`w-full sm:w-auto mt-4 sm:mt-4 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        pointsAdjustment !== 0
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Aplicar Ajuste
                    </button>
                  </div>
                </div>

                {/* Orders History List */}
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-blue-400" />
                    Historial de Pedidos Recientes ({selectedCustomerForHistory.orders?.length || 0})
                  </h4>

                  {!selectedCustomerForHistory.orders || selectedCustomerForHistory.orders.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                      No hay pedidos registrados para este cliente aún.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCustomerForHistory.orders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{order.orderNumber}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {order.source}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                order.status === 'DELIVERED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-blue-950 text-blue-400'
                              }`}>
                                {order.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(order.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                            {order.items && order.items.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1">
                                {order.items.map(i => `${i.quantity}x ${i.product?.name || 'Producto'}`).join(', ')}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold text-emerald-400">${order.total.toFixed(2)}</span>
                            <p className="text-[10px] text-purple-400 font-semibold">
                              +{Math.floor(order.total / 10)} pts ganados
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
