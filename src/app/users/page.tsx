'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Store, 
  Flame, 
  Coins, 
  Truck, 
  Edit3, 
  Trash2, 
  User as UserIcon
} from 'lucide-react';

interface BrandRef {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'BRAND_ADMIN' | 'CASHIER' | 'KITCHEN' | 'DELIVERY';
  createdAt: string;
  brands: Array<{
    brand: BrandRef;
  }>;
  deliveryProfile?: {
    vehicleType: string;
    plateNumber?: string | null;
    status: string;
  } | null;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allBrands, setAllBrands] = useState<BrandRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State: Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'SUPER_ADMIN' | 'BRAND_ADMIN' | 'CASHIER' | 'KITCHEN' | 'DELIVERY'>('CASHIER');
  const [formSelectedBrandIds, setFormSelectedBrandIds] = useState<string[]>([]);
  const [formVehicleType, setFormVehicleType] = useState('MOTO');
  const [formPlateNumber, setFormPlateNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const { addNotification } = useAppStore();

  const fetchStaffData = useCallback(async () => {
    try {
      const [usersRes, brandsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/brands'),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (brandsRes.ok) {
        const brandsData = await brandsRes.json();
        setAllBrands(brandsData.brands || []);
      }
    } catch (err) {
      console.error('Failed to load users data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('CASHIER');
    setFormSelectedBrandIds(allBrands.map(b => b.id)); // Default access to all brands
    setFormVehicleType('MOTO');
    setFormPlateNumber('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u: UserItem) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword(''); // Empty by default unless changing
    setFormRole(u.role);
    setFormSelectedBrandIds(u.brands.map(ub => ub.brand.id));
    setFormVehicleType(u.deliveryProfile?.vehicleType || 'MOTO');
    setFormPlateNumber(u.deliveryProfile?.plateNumber || '');
    setIsModalOpen(true);
  };

  // Submit Save
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;

    if (!editingUser && !formPassword) {
      alert('Debes definir una contraseña para el nuevo usuario');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // PATCH
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingUser.id,
            name: formName,
            email: formEmail,
            password: formPassword || undefined,
            role: formRole,
            brandIds: formSelectedBrandIds,
            vehicleType: formRole === 'DELIVERY' ? formVehicleType : undefined,
            plateNumber: formRole === 'DELIVERY' ? formPlateNumber : undefined,
          }),
        });

        if (res.ok) {
          addNotification(`Usuario "${formName}" actualizado`, 'success');
          setIsModalOpen(false);
          fetchStaffData();
        } else {
          const data = await res.json();
          alert(`Error: ${data.error}`);
        }
      } else {
        // POST
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            password: formPassword,
            role: formRole,
            brandIds: formSelectedBrandIds,
            vehicleType: formRole === 'DELIVERY' ? formVehicleType : undefined,
            plateNumber: formRole === 'DELIVERY' ? formPlateNumber : undefined,
          }),
        });

        if (res.ok) {
          addNotification(`Empleado "${formName}" creado exitosamente`, 'success');
          setIsModalOpen(false);
          fetchStaffData();
        } else {
          const data = await res.json();
          alert(`Error: ${data.error}`);
        }
      }
    } catch {
      alert('Error de red al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${u.name}" (${u.email})?`)) return;

    try {
      const res = await fetch(`/api/users?id=${u.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        addNotification(`Usuario "${u.name}" eliminado`, 'info');
        fetchStaffData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red al eliminar usuario');
    }
  };

  const toggleBrandSelection = (brandId: string) => {
    setFormSelectedBrandIds((prev) => 
      prev.includes(brandId) ? prev.filter(id => id !== brandId) : [...prev, brandId]
    );
  };

  // Helper: Role badge styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', bg: 'bg-purple-950/60 border-purple-800 text-purple-300', icon: ShieldCheck };
      case 'BRAND_ADMIN':
        return { label: 'Gerente Marca', bg: 'bg-blue-950/60 border-blue-800 text-blue-300', icon: Store };
      case 'CASHIER':
        return { label: 'Cajero / Salón', bg: 'bg-emerald-950/60 border-emerald-800 text-emerald-300', icon: Coins };
      case 'KITCHEN':
        return { label: 'Cocinero KDS', bg: 'bg-amber-950/60 border-amber-800 text-amber-300', icon: Flame };
      case 'DELIVERY':
        return { label: 'Repartidor', bg: 'bg-cyan-950/60 border-cyan-800 text-cyan-300', icon: Truck };
      default:
        return { label: role, bg: 'bg-slate-800 border-slate-700 text-slate-300', icon: UserIcon };
    }
  };

  // Filtering
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  // Metrics
  const totalStaff = users.length;
  const adminCount = users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'BRAND_ADMIN').length;
  const cashierCount = users.filter(u => u.role === 'CASHIER').length;
  const kitchenCount = users.filter(u => u.role === 'KITCHEN').length;
  const driverCount = users.filter(u => u.role === 'DELIVERY').length;

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando personal y roles...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Personal & Roles de Cocina</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Administración de accesos, credenciales y asignación de marcas para colaboradores
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer transition-all duration-200"
          >
            <UserPlus className="h-4 w-4" /> Dar de Alta Empleado
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Equipo</span>
              <p className="text-2xl font-black text-white mt-1">{totalStaff}</p>
            </div>
            <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-purple-400 font-semibold uppercase">Admins</span>
              <p className="text-2xl font-black text-purple-400 mt-1">{adminCount}</p>
            </div>
            <div className="p-2 bg-purple-950/40 border border-purple-900/40 rounded-lg text-purple-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase">Cajeros & POS</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">{cashierCount}</p>
            </div>
            <div className="p-2 bg-emerald-950/40 border border-emerald-900/40 rounded-lg text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-semibold uppercase">Cocina KDS</span>
              <p className="text-2xl font-black text-amber-400 mt-1">{kitchenCount}</p>
            </div>
            <div className="p-2 bg-amber-950/40 border border-amber-900/40 rounded-lg text-amber-400">
              <Flame className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-cyan-400 font-semibold uppercase">Repartidores</span>
              <p className="text-2xl font-black text-cyan-400 mt-1">{driverCount}</p>
            </div>
            <div className="p-2 bg-cyan-950/40 border border-cyan-900/40 rounded-lg text-cyan-400">
              <Truck className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <UserIcon className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar personal por nombre o correo electrónico..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-brand-primary"
            />
          </div>

          <div className="flex overflow-x-auto gap-2 py-1 max-w-full">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'SUPER_ADMIN', label: 'Super Admin' },
              { id: 'BRAND_ADMIN', label: 'Gerentes' },
              { id: 'CASHIER', label: 'Cajeros' },
              { id: 'KITCHEN', label: 'Cocineros' },
              { id: 'DELIVERY', label: 'Repartidores' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border shrink-0 transition-all cursor-pointer ${
                  roleFilter === tab.id
                    ? 'bg-brand-primary border-brand-primary text-slate-950 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Users Cards Grid */}
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center glass-panel border border-slate-800 rounded-xl space-y-3">
            <Users className="h-10 w-10 mx-auto text-slate-600" />
            <h4 className="font-bold text-white text-base">No se encontró personal</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No hay colaboradores registrados que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((u) => {
              const badge = getRoleBadge(u.role);
              const RoleIcon = badge.icon;
              const initials = u.name.slice(0, 2).toUpperCase();

              return (
                <div
                  key={u.id}
                  className="glass-panel border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all duration-200"
                >
                  <div className="space-y-3">
                    {/* User Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm">
                          {initials}
                        </div>
                        <div className="truncate max-w-[180px]">
                          <h4 className="font-bold text-white text-sm truncate">{u.name}</h4>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${badge.bg}`}>
                        <RoleIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </div>

                    {/* Brands Assigned */}
                    <div className="pt-2 border-t border-slate-850 space-y-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">Marcas con Acceso:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {u.role === 'SUPER_ADMIN' ? (
                          <span className="bg-purple-950/40 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-purple-900/50">
                            ⭐ Todas las Marcas (Global)
                          </span>
                        ) : u.brands.length > 0 ? (
                          u.brands.map((ub) => (
                            <span
                              key={ub.brand.id}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-300 flex items-center gap-1"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ub.brand.primaryColor }} />
                              {ub.brand.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Sin marcas asignadas</span>
                        )}
                      </div>
                    </div>

                    {/* Driver vehicle info */}
                    {u.role === 'DELIVERY' && u.deliveryProfile && (
                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5 text-cyan-400" />
                          Vehículo: <strong className="text-slate-200">{u.deliveryProfile.vehicleType}</strong>
                        </span>
                        {u.deliveryProfile.plateNumber && (
                          <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px] text-slate-300">
                            {u.deliveryProfile.plateNumber}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-850 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => handleOpenEditModal(u)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Editar / Acceso
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 border border-transparent hover:border-red-900/50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar Usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL: CREATE / EDIT USER */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                ✕
              </button>

              <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-white">
                  {editingUser ? `Editar Colaborador: ${editingUser.name}` : 'Dar de Alta Nuevo Colaborador'}
                </h3>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Ana Gómez"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Correo Electrónico *</label>
                    <input
                      type="email"
                      required
                      placeholder="ana@darkflow.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">
                      {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                    </label>
                    <input
                      type="password"
                      placeholder={editingUser ? 'Dejar en blanco para no cambiar' : '••••••••'}
                      required={!editingUser}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Rol Operativo *</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as 'SUPER_ADMIN' | 'BRAND_ADMIN' | 'CASHIER' | 'KITCHEN' | 'DELIVERY')}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:border-brand-primary outline-none"
                    >
                      <option value="CASHIER">Cajero & Punto de Venta / Salón</option>
                      <option value="KITCHEN">Cocinero (Kitchen Display System)</option>
                      <option value="DELIVERY">Repartidor de Cocina</option>
                      <option value="BRAND_ADMIN">Gerente de Marca</option>
                      <option value="SUPER_ADMIN">Super Administrador (Global)</option>
                    </select>
                  </div>
                </div>

                {/* Delivery driver fields */}
                {formRole === 'DELIVERY' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/80 border border-cyan-950/60 rounded-lg">
                    <div className="space-y-1">
                      <label className="font-semibold text-cyan-400">Tipo de Vehículo</label>
                      <select
                        value={formVehicleType}
                        onChange={(e) => setFormVehicleType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 rounded px-2.5 py-2 text-slate-200 outline-none"
                      >
                        <option value="MOTO">🏍️ Motocicleta</option>
                        <option value="BICI">🚲 Bicicleta</option>
                        <option value="AUTO">🚗 Automóvil</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-400">Placas / Identificador</label>
                      <input
                        type="text"
                        placeholder="CDMX-4521"
                        value={formPlateNumber}
                        onChange={(e) => setFormPlateNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 rounded px-2.5 py-2 text-slate-200 outline-none"
                      >
                      </input>
                    </div>
                  </div>
                )}

                {/* Brand Access Checkboxes */}
                {formRole !== 'SUPER_ADMIN' && (
                  <div className="space-y-2 pt-2 border-t border-slate-850">
                    <label className="font-semibold text-slate-400">Marcas Virtuales Asignadas:</label>
                    <p className="text-[11px] text-slate-500">El usuario solo podrá operar y visualizar las marcas seleccionadas:</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {allBrands.map((b) => {
                        const isChecked = formSelectedBrandIds.includes(b.id);
                        return (
                          <div
                            key={b.id}
                            onClick={() => toggleBrandSelection(b.id)}
                            className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-slate-850 border-brand-primary/60 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: b.primaryColor }} />
                              <span className="font-bold text-xs">{b.name}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-brand-primary pointer-events-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold rounded-lg shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingUser ? 'Actualizar Colaborador' : 'Crear Colaborador'}
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
