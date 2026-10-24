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
  User as UserIcon,
  Clock,
  Key,
  Calendar,
  Download,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  X,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  LogOut,
  Sliders,
  Building2,
  TrendingUp
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
  role: 'SUPER_ADMIN' | 'BRAND_ADMIN' | 'CASHIER' | 'KITCHEN' | 'DELIVERY' | 'FRANCHISEE' | 'INVESTOR' | 'WAITER';
  createdAt: string;
  pinCode?: string | null;
  brands: Array<{
    brand: BrandRef;
  }>;
  deliveryProfile?: {
    vehicleType: string;
    plateNumber?: string | null;
    status: string;
  } | null;
}

interface AttendanceItem {
  id: string;
  userId: string;
  brandId: string;
  clockIn: string;
  clockOut?: string | null;
  breakMinutes: number;
  totalHours?: number | null;
  status: 'ACTIVE' | 'COMPLETED' | 'AUTO_CLOSED';
  notes?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
}

export default function UsersManagementPage() {
  const { activeBrand, addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<'STAFF' | 'ATTENDANCE'>('STAFF');

  // Staff State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allBrands, setAllBrands] = useState<BrandRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Staff Modal State: Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  
  // Staff Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'SUPER_ADMIN' | 'BRAND_ADMIN' | 'CASHIER' | 'KITCHEN' | 'DELIVERY' | 'FRANCHISEE' | 'INVESTOR' | 'WAITER'>('CASHIER');
  const [formSelectedBrandIds, setFormSelectedBrandIds] = useState<string[]>([]);
  const [formVehicleType, setFormVehicleType] = useState('MOTO');
  const [formPlateNumber, setFormPlateNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinTargetUser, setPinTargetUser] = useState<UserItem | null>(null);
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceItem[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceMetrics, setAttendanceMetrics] = useState<{
    totalRecords: number;
    activeCount: number;
    completedCount: number;
    totalHours: number;
  } | null>(null);
  const [attendanceDateRange, setAttendanceDateRange] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');
  const [attendanceUserFilter, setAttendanceUserFilter] = useState('ALL');

  // Manual Shift Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<AttendanceItem | null>(null);
  const [shiftUserId, setShiftUserId] = useState('');
  const [shiftClockIn, setShiftClockIn] = useState('');
  const [shiftClockOut, setShiftClockOut] = useState('');
  const [shiftBreakMinutes, setShiftBreakMinutes] = useState(0);
  const [shiftNotes, setShiftNotes] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  // Live timer for active shifts
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

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

  const fetchAttendanceData = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingAttendance(true);

    try {
      const now = new Date();
      let startDateStr = '';
      const endDateStr = now.toISOString().split('T')[0];

      if (attendanceDateRange === 'TODAY') {
        startDateStr = endDateStr;
      } else if (attendanceDateRange === 'WEEK') {
        const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateStr = pastWeek.toISOString().split('T')[0];
      } else if (attendanceDateRange === 'MONTH') {
        const pastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = pastMonth.toISOString().split('T')[0];
      }

      const params = new URLSearchParams();
      if (startDateStr) params.append('startDate', startDateStr);
      if (endDateStr && attendanceDateRange !== 'ALL') params.append('endDate', endDateStr);
      if (attendanceUserFilter !== 'ALL') params.append('userId', attendanceUserFilter);

      const res = await fetch(`/api/attendance?${params.toString()}`, {
        headers: { 'x-brand-id': activeBrand.id },
      });

      if (res.ok) {
        const data = await res.json();
        setAttendanceRecords(data.records || []);
        setAttendanceMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error('Error fetching attendance records', err);
    } finally {
      setLoadingAttendance(false);
    }
  }, [activeBrand?.id, attendanceDateRange, attendanceUserFilter]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  useEffect(() => {
    if (activeTab === 'ATTENDANCE') {
      fetchAttendanceData();
    }
  }, [activeTab, fetchAttendanceData]);

  // Open Create Staff Modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('CASHIER');
    setFormSelectedBrandIds(allBrands.map(b => b.id));
    setFormVehicleType('MOTO');
    setFormPlateNumber('');
    setIsModalOpen(true);
  };

  // Open Edit Staff Modal
  const handleOpenEditModal = (u: UserItem) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword('');
    setFormRole(u.role);
    setFormSelectedBrandIds(u.brands.map(ub => ub.brand.id));
    setFormVehicleType(u.deliveryProfile?.vehicleType || 'MOTO');
    setFormPlateNumber(u.deliveryProfile?.plateNumber || '');
    setIsModalOpen(true);
  };

  // Submit Save Staff
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) {
      alert('Nombre y correo son requeridos');
      return;
    }

    if (!editingUser && !formPassword) {
      alert('La contraseña es requerida para nuevos usuarios');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formName,
        email: formEmail,
        role: formRole,
        brandIds: formSelectedBrandIds,
      };

      if (formPassword) {
        payload.password = formPassword;
      }

      if (formRole === 'DELIVERY') {
        payload.vehicleType = formVehicleType;
        payload.plateNumber = formPlateNumber;
      }

      let res;
      if (editingUser) {
        res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok) {
        addNotification(editingUser ? 'Empleado actualizado' : 'Empleado registrado exitosamente', 'success');
        setIsModalOpen(false);
        fetchStaffData();
      } else {
        alert(data.error || 'Ocurrió un error al guardar el usuario');
      }
    } catch {
      alert('Error de red al procesar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  // Delete Staff
  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${name}"?`)) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addNotification(`Usuario "${name}" eliminado`, 'info');
        fetchStaffData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red al eliminar usuario');
    }
  };

  // Open PIN Modal
  const openPinModal = (u: UserItem) => {
    setPinTargetUser(u);
    setNewPin(u.pinCode || '');
    setPinModalOpen(true);
  };

  // Save PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTargetUser) return;

    if (newPin && !/^\d{4}$/.test(newPin.trim())) {
      addNotification('El PIN debe tener exactamente 4 dígitos numéricos', 'warning');
      return;
    }

    setSavingPin(true);
    try {
      const res = await fetch(`/api/users/${pinTargetUser.id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: newPin.trim() || null }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(data.message || 'PIN actualizado', 'success');
        setPinModalOpen(false);
        fetchStaffData();
      } else {
        addNotification(data.error || 'Error al actualizar PIN', 'error');
      }
    } catch {
      addNotification('Error de conexión al configurar PIN', 'error');
    } finally {
      setSavingPin(false);
    }
  };

  // Supervisor Quick Clock-Out
  const handleSupervisorClockOut = async (recordId: string, employeeName: string) => {
    if (!confirm(`¿Registrar salida de turno para ${employeeName}?`)) return;

    try {
      const res = await fetch(`/api/attendance/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockOut: new Date().toISOString(),
          notes: 'Salida registrada por supervisor',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(`Turno finalizado para ${employeeName} (${data.record?.totalHours || 0} hrs)`, 'success');
        fetchAttendanceData();
      } else {
        addNotification(data.error || 'Error al finalizar turno', 'error');
      }
    } catch {
      addNotification('Error al contactar servidor', 'error');
    }
  };

  // Open Manual Shift Modal
  const openManualShiftModal = (rec?: AttendanceItem) => {
    if (rec) {
      setEditingShift(rec);
      setShiftUserId(rec.userId);
      setShiftClockIn(rec.clockIn ? new Date(rec.clockIn).toISOString().slice(0, 16) : '');
      setShiftClockOut(rec.clockOut ? new Date(rec.clockOut).toISOString().slice(0, 16) : '');
      setShiftBreakMinutes(rec.breakMinutes || 0);
      setShiftNotes(rec.notes || '');
    } else {
      setEditingShift(null);
      setShiftUserId(users[0]?.id || '');
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
      setShiftClockIn(startOfDay.toISOString().slice(0, 16));
      setShiftClockOut(now.toISOString().slice(0, 16));
      setShiftBreakMinutes(30);
      setShiftNotes('');
    }
    setShiftModalOpen(true);
  };

  // Save Shift Record
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) return;

    if (!shiftUserId || !shiftClockIn) {
      addNotification('Selecciona colaborador y hora de entrada', 'warning');
      return;
    }

    setSavingShift(true);
    try {
      const payload = {
        brandId: activeBrand.id,
        userId: shiftUserId,
        clockIn: new Date(shiftClockIn).toISOString(),
        clockOut: shiftClockOut ? new Date(shiftClockOut).toISOString() : null,
        breakMinutes: Number(shiftBreakMinutes) || 0,
        notes: shiftNotes.trim() || null,
      };

      const url = editingShift ? `/api/attendance/${editingShift.id}` : '/api/attendance';
      const method = editingShift ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-brand-id': activeBrand.id },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(
          editingShift ? 'Turno modificado correctamente' : 'Turno manual registrado con éxito',
          'success'
        );
        setShiftModalOpen(false);
        fetchAttendanceData();
      } else {
        addNotification(data.error || 'Error al guardar turno', 'error');
      }
    } catch {
      addNotification('Error de red al guardar turno', 'error');
    } finally {
      setSavingShift(false);
    }
  };

  // Delete Shift Record
  const handleDeleteShift = async (id: string) => {
    if (!confirm('¿Eliminar este registro de asistencia permanentemente?')) return;

    try {
      const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addNotification('Registro de asistencia eliminado', 'info');
        fetchAttendanceData();
      } else {
        addNotification('Error al eliminar registro', 'error');
      }
    } catch {
      addNotification('Error de conexión', 'error');
    }
  };

  // Export Payroll CSV
  const exportPayrollCsv = () => {
    if (attendanceRecords.length === 0) {
      addNotification('No hay registros para exportar', 'warning');
      return;
    }

    const headers = ['Colaborador', 'Rol', 'Fecha', 'Entrada', 'Salida', 'Descanso (min)', 'Horas Efectivas', 'Estado', 'Notas'];
    const rows = attendanceRecords.map((r) => {
      const cIn = new Date(r.clockIn);
      const cOut = r.clockOut ? new Date(r.clockOut) : null;
      return [
        `"${r.user.name}"`,
        `"${r.user.role}"`,
        `"${cIn.toLocaleDateString('es-MX')}"`,
        `"${cIn.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}"`,
        cOut ? `"${cOut.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}"` : '"En Turno"',
        r.breakMinutes || 0,
        r.totalHours !== null ? r.totalHours : '---',
        `"${r.status}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nomina_Asistencia_${activeBrand?.slug || 'darkflow'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification('Reporte de nómina descargado en formato CSV', 'success');
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
      case 'FRANCHISEE':
        return { label: 'Franquiciatario B2B', bg: 'bg-indigo-950/60 border-indigo-800 text-indigo-300', icon: Building2 };
      case 'INVESTOR':
        return { label: 'Socio Inversionista', bg: 'bg-emerald-950/60 border-emerald-800 text-emerald-300', icon: TrendingUp };
      default:
        return { label: role, bg: 'bg-slate-800 border-slate-700 text-slate-300', icon: UserIcon };
    }
  };

  // Filtering for staff
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const activeShifts = attendanceRecords.filter((r) => r.status === 'ACTIVE');

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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Equipo, Roles & Reloj Checador</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Control integral de personal, permisos de acceso RBAC, turnos en vivo y registro de asistencia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'STAFF' ? (
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer transition-all duration-200"
              >
                <UserPlus className="h-4 w-4" /> Dar de Alta Empleado
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportPayrollCsv}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Nómina CSV
                </button>
                <button
                  onClick={() => openManualShiftModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" /> Registro Manual
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
          <button
            onClick={() => setActiveTab('STAFF')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'STAFF'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-brand-primary" />
            Personal & Permisos (RBAC)
          </button>

          <button
            onClick={() => setActiveTab('ATTENDANCE')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'ATTENDANCE'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-cyan-400" />
            Control de Asistencia & Nómina
            {activeShifts.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {activeShifts.length} en turno
              </span>
            )}
          </button>
        </div>

        {/* ================= TAB 1: STAFF MANAGEMENT ================= */}
        {activeTab === 'STAFF' && (
          <div className="space-y-6">
            {/* KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Equipo</span>
                  <p className="text-2xl font-black text-white mt-1">{users.length}</p>
                </div>
                <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
                  <Users className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-purple-400 font-semibold uppercase">Admins</span>
                  <p className="text-2xl font-black text-purple-400 mt-1">
                    {users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'BRAND_ADMIN').length}
                  </p>
                </div>
                <div className="p-2 bg-purple-950/40 border border-purple-900/40 rounded-lg text-purple-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">Cajeros & POS</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {users.filter(u => u.role === 'CASHIER').length}
                  </p>
                </div>
                <div className="p-2 bg-emerald-950/40 border border-emerald-900/40 rounded-lg text-emerald-400">
                  <Coins className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase">Cocina KDS</span>
                  <p className="text-2xl font-black text-amber-400 mt-1">
                    {users.filter(u => u.role === 'KITCHEN').length}
                  </p>
                </div>
                <div className="p-2 bg-amber-950/40 border border-amber-900/40 rounded-lg text-amber-400">
                  <Flame className="h-5 w-5" />
                </div>
              </div>

              <div className="glass-panel border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-cyan-400 font-semibold uppercase">Repartidores</span>
                  <p className="text-2xl font-black text-cyan-400 mt-1">
                    {users.filter(u => u.role === 'DELIVERY').length}
                  </p>
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
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-200 outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex overflow-x-auto gap-2 py-1 max-w-full">
                {(['ALL', 'SUPER_ADMIN', 'BRAND_ADMIN', 'FRANCHISEE', 'INVESTOR', 'CASHIER', 'KITCHEN', 'DELIVERY'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                      roleFilter === r
                        ? 'bg-brand-primary text-slate-950 font-bold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r === 'ALL' ? 'Todos los Roles' : getRoleBadge(r).label}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((u) => {
                const badge = getRoleBadge(u.role);
                const BadgeIcon = badge.icon;
                const hasPin = Boolean(u.pinCode);

                return (
                  <div 
                    key={u.id}
                    className="glass-panel border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm">{u.name}</h4>
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">{u.email}</p>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <BadgeIcon className="h-3 w-3" />
                          {badge.label}
                        </span>
                      </div>

                      {/* PIN and Brands row */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Reloj Checador:</span>
                          <button
                            onClick={() => openPinModal(u)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                              hasPin
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                            title="Configurar PIN de 4 dígitos"
                          >
                            <Key className="w-2.5 h-2.5" />
                            {hasPin ? 'PIN: ••••' : 'Sin PIN'}
                          </button>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {u.brands.length} marca(s)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                      <button
                        onClick={() => openPinModal(u)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                      >
                        <Key className="w-3.5 h-3.5" />
                        {hasPin ? 'Cambiar PIN' : 'Asignar PIN'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                          title="Editar permisos"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 2: ATTENDANCE & PAYROLL ================= */}
        {activeTab === 'ATTENDANCE' && (
          <div className="space-y-6">
            {/* Live Active Shifts Cards */}
            {activeShifts.length > 0 && (
              <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 space-y-3 bg-gradient-to-r from-cyan-950/20 via-slate-900 to-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Personal en Turno Activo Ahora ({activeShifts.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Sucursal: {activeBrand?.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {activeShifts.map((rec) => {
                    const elapsedMs = Math.max(0, currentTime - new Date(rec.clockIn).getTime());
                    const elapsedMins = Math.floor(elapsedMs / (1000 * 60));
                    const hours = Math.floor(elapsedMins / 60);
                    const mins = elapsedMins % 60;
                    const elapsedFormatted = `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;

                    return (
                      <div
                        key={rec.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between space-y-2.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-white text-xs truncate">{rec.user.name}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {rec.user.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Entrada: {new Date(rec.clockIn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" />
                            {elapsedFormatted}
                          </span>
                          <button
                            onClick={() => handleSupervisorClockOut(rec.id, rec.user.name)}
                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold border border-red-500/20 transition-all flex items-center gap-1"
                          >
                            <LogOut className="w-2.5 h-2.5" /> Salida
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attendance KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] text-emerald-400 font-semibold uppercase">En Turno Ahora</span>
                <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                  {attendanceMetrics?.activeCount || 0}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Colaboradores laborando</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] text-cyan-400 font-semibold uppercase">Horas Efectivas Período</span>
                <p className="text-2xl font-black text-cyan-400 mt-1 font-mono">
                  {(attendanceMetrics?.totalHours || 0).toFixed(1)} <span className="text-xs text-slate-500">hrs</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Descontando pausas y descansos</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] text-purple-400 font-semibold uppercase">Turnos Completados</span>
                <p className="text-2xl font-black text-purple-400 mt-1 font-mono">
                  {attendanceMetrics?.completedCount || 0}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Checadas de entrada y salida cerradas</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] text-amber-400 font-semibold uppercase">Promedio / Turno</span>
                <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                  {attendanceMetrics?.completedCount ? ((attendanceMetrics.totalHours || 0) / attendanceMetrics.completedCount).toFixed(1) : 0} <span className="text-xs text-slate-500">hrs</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Jornada media por colaborador</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Rango:</span>
                {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map((rng) => (
                  <button
                    key={rng}
                    onClick={() => setAttendanceDateRange(rng)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      attendanceDateRange === rng
                        ? 'bg-brand-primary text-slate-950 shadow-md'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rng === 'TODAY' ? 'Hoy' : rng === 'WEEK' ? 'Últimos 7 días' : rng === 'MONTH' ? 'Este Mes' : 'Histórico Total'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={attendanceUserFilter}
                  onChange={(e) => setAttendanceUserFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-brand-primary"
                >
                  <option value="ALL">Todos los Colaboradores</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>

                <button
                  onClick={fetchAttendanceData}
                  disabled={loadingAttendance}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
                  title="Refrescar datos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAttendance ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Attendance History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Colaborador</th>
                      <th className="py-3.5 px-4">Fecha</th>
                      <th className="py-3.5 px-4">Entrada</th>
                      <th className="py-3.5 px-4">Salida</th>
                      <th className="py-3.5 px-4">Descanso</th>
                      <th className="py-3.5 px-4">Horas Efectivas</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4">Notas</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          No se encontraron registros de asistencia para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((rec) => {
                        const cIn = new Date(rec.clockIn);
                        const cOut = rec.clockOut ? new Date(rec.clockOut) : null;
                        const isOnline = rec.status === 'ACTIVE';

                        return (
                          <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-bold text-white">{rec.user.name}</p>
                              <span className="text-[10px] text-slate-400">{rec.user.role}</span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {cIn.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                              {cIn.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {cOut ? (
                                cOut.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                              ) : (
                                <span className="text-cyan-400 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                  En Turno
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              {rec.breakMinutes || 0} min
                            </td>
                            <td className="py-3 px-4">
                              {typeof rec.totalHours === 'number' ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">
                                  {rec.totalHours.toFixed(2)} hrs
                                </span>
                              ) : (
                                <span className="text-slate-500">---</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOnline 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}>
                                {isOnline ? '🟢 Activo' : 'Completado'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[150px] truncate">
                              {rec.notes || '---'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openManualShiftModal(rec)}
                                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                                  title="Editar registro"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteShift(rec.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
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

        {/* ================= PIN CONFIGURATION MODAL ================= */}
        {pinModalOpen && pinTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Key className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-sm">PIN de Reloj Checador</h3>
                    <p className="text-[10px] text-slate-400">{pinTargetUser.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPinModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePin} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Clave Numérica de 4 Dígitos
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Este PIN permite al colaborador registrar su entrada y salida rápidamente en el reloj checador táctil. Déjalo en blanco para desactivarlo.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingPin}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-900/30"
                  >
                    {savingPin ? 'Guardando...' : 'Guardar PIN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MANUAL SHIFT ADJUSTMENT MODAL ================= */}
        {shiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    <Clock className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {editingShift ? 'Modificar Registro de Turno' : 'Registro Manual de Asistencia'}
                    </h3>
                    <p className="text-[10px] text-slate-400">Ajuste de horas y bitácora de supervisor</p>
                  </div>
                </div>
                <button
                  onClick={() => setShiftModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveShift} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Colaborador *
                  </label>
                  <select
                    disabled={Boolean(editingShift)}
                    value={shiftUserId}
                    onChange={(e) => setShiftUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Fecha / Hora Entrada *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={shiftClockIn}
                      onChange={(e) => setShiftClockIn(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Fecha / Hora Salida
                    </label>
                    <input
                      type="datetime-local"
                      value={shiftClockOut}
                      onChange={(e) => setShiftClockOut(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Minutos de Descanso / Comida
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={shiftBreakMinutes}
                    onChange={(e) => setShiftBreakMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Notas o Motivo del Ajuste
                  </label>
                  <input
                    type="text"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="Ej. Olvido de checada, cambio de turno autorizado..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShiftModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingShift}
                    className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
                  >
                    {savingShift ? 'Guardando...' : editingShift ? 'Actualizar Turno' : 'Registrar Turno'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= CREATE / EDIT STAFF MODAL ================= */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {editingUser ? 'Editar Colaborador' : 'Alta de Nuevo Empleado'}
                    </h3>
                    <p className="text-xs text-slate-400">Asignación de rol y marcas de operación</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. Juan Pérez García"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Correo Electrónico (Usuario) *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="juan@darkflow.app"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {editingUser ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña de Acceso *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? '••••••••' : 'Mínimo 6 caracteres'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Rol Operativo *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="CASHIER">Cajero & Punto de Venta (POS)</option>
                    <option value="KITCHEN">Cocinero & Pantalla KDS</option>
                    <option value="DELIVERY">Repartidor de Entregas</option>
                    <option value="FRANCHISEE">Franquiciatario B2B (Portal de Regalías)</option>
                    <option value="INVESTOR">Socio Inversionista B2B (Portal de Dividendos)</option>
                    <option value="BRAND_ADMIN">Gerente de Marca (Acceso total a su marca)</option>
                    <option value="SUPER_ADMIN">Super Administrador (Acceso total)</option>
                  </select>
                </div>

                {formRole === 'DELIVERY' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Vehículo
                      </label>
                      <select
                        value={formVehicleType}
                        onChange={(e) => setFormVehicleType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="MOTO">Motocicleta</option>
                        <option value="BICI">Bicicleta</option>
                        <option value="AUTO">Automóvil</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Placa / Matrícula
                      </label>
                      <input
                        type="text"
                        value={formPlateNumber}
                        onChange={(e) => setFormPlateNumber(e.target.value)}
                        placeholder="ABC-123"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Marcas con Acceso Permitido
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-xl">
                    {allBrands.map((b) => {
                      const isSelected = formSelectedBrandIds.includes(b.id);
                      return (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => toggleBrandSelection(b.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border text-left transition-all ${
                            isSelected
                              ? 'bg-slate-900 border-brand-primary text-white'
                              : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                            isSelected ? 'bg-brand-primary border-brand-primary text-slate-950 font-bold' : 'border-slate-700'
                          }`}>
                            {isSelected && '✓'}
                          </span>
                          <span className="truncate">{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 rounded-xl text-xs font-bold shadow-lg"
                  >
                    {saving ? 'Guardando...' : editingUser ? 'Actualizar' : 'Guardar Empleado'}
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
