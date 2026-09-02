'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Flame, 
  Package, 
  Coins, 
  Truck, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  ChevronDown,
  UtensilsCrossed,
  LayoutGrid,
  Users
} from 'lucide-react';
import Link from 'next/link';

interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  brandIds: string[];
  activeBrandId?: string;
  activeBrand?: {
    id: string;
    name: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
}

export default function DashboardContainer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserSession | null>(null);
  const [brands, setBrands] = useState<Array<{ id: string; name: string; primaryColor: string; secondaryColor: string; logoUrl?: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  
  const { activeBrand, setActiveBrand, notifications, addNotification } = useAppStore();

  const fetchSession = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
        
        // Fetch all brands available to the user
        const brandsRes = await fetch('/api/brands');
        if (brandsRes.ok) {
          const brandsData = await brandsRes.json();
          setBrands(brandsData.brands);
          
          // Set active brand in Zustand
          const currentBrand = brandsData.brands.find(
            (b: { id: string }) => b.id === (data.user.activeBrandId || data.user.brandIds[0])
          );
          if (currentBrand) {
            setActiveBrand(currentBrand);
          }
        }
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error('Failed to load session', err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router, setActiveBrand]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleBrandChange = async (brandId: string) => {
    try {
      setLoading(true);
      setBrandDropdownOpen(false);
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      if (res.ok) {
        const selectedBrand = brands.find((b) => b.id === brandId) || null;
        setActiveBrand(selectedBrand);
        addNotification(`Cambiado a marca: ${selectedBrand?.name}`, 'success');
        // Refresh full page state to update client contexts
        window.location.reload();
      } else {
        console.error('Failed to switch brand');
      }
    } catch (err) {
      console.error('Error switching brand', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setActiveBrand(null);
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100 flex-col gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-brand-primary"></div>
        <p className="text-slate-400 font-medium">Cargando DarkFlow Manager...</p>
      </div>
    );
  }

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'BRAND_ADMIN'] },
    { name: 'POS Ventas', path: '/pos', icon: ShoppingBag, roles: ['SUPER_ADMIN', 'BRAND_ADMIN', 'CASHIER'] },
    { name: 'Salón & Mesas', path: '/tables', icon: LayoutGrid, roles: ['SUPER_ADMIN', 'BRAND_ADMIN', 'CASHIER'] },
    { name: 'KDS Cocina', path: '/kitchen', icon: Flame, roles: ['SUPER_ADMIN', 'BRAND_ADMIN', 'KITCHEN'] },
    { name: 'Menú & Catálogo', path: '/menu', icon: UtensilsCrossed, roles: ['SUPER_ADMIN', 'BRAND_ADMIN'] },
    { name: 'Inventario', path: '/inventory', icon: Package, roles: ['SUPER_ADMIN', 'BRAND_ADMIN'] },
    { name: 'Corte de Caja', path: '/cash', icon: Coins, roles: ['SUPER_ADMIN', 'BRAND_ADMIN', 'CASHIER'] },
    { name: 'Repartidores', path: '/drivers', icon: Truck, roles: ['SUPER_ADMIN', 'BRAND_ADMIN', 'CASHIER'] },
    { name: 'Personal & Roles', path: '/users', icon: Users, roles: ['SUPER_ADMIN', 'BRAND_ADMIN'] },
  ];

  // Filter menu items by user role
  const userRole = user?.role || '';
  const filteredMenuItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-slate-900 border-r border-slate-800 flex-shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          {activeBrand?.logoUrl ? (
            <img src={activeBrand.logoUrl} alt={activeBrand.name} className="h-8 w-8 rounded-full object-cover border border-brand-primary" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-brand-primary flex items-center justify-center font-bold text-slate-950 text-sm">DF</div>
          )}
          <span className="font-bold text-lg tracking-wide text-white">DarkFlow</span>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-brand-primary text-slate-950 shadow-md font-bold' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile / Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                <UserIcon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate max-w-[120px]">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role.replace('_', ' ').toLowerCase()}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/50 rounded-lg transition-all duration-200"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
          <div className="relative flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-full">
            <div className="absolute top-4 right-4">
              <button 
                className="p-1 text-slate-400 hover:text-white rounded-md border border-slate-700" 
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
              <span className="font-bold text-lg tracking-wide text-white">DarkFlow</span>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                      isActive 
                        ? 'bg-brand-primary text-slate-950 font-bold' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-900">
              <p className="text-sm font-semibold text-white mb-2">{user?.name}</p>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-white md:hidden border border-slate-800 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* Title / Info */}
            <h1 className="text-lg font-bold text-white hidden sm:block">
              {filteredMenuItems.find((item) => item.path === pathname)?.name || 'Panel'}
            </h1>
          </div>

          {/* Multi-Brand Switcher & Notifications */}
          <div className="flex items-center gap-4">
            {/* Toast Counter (Visual feedback of simulated notifications) */}
            {notifications.length > 0 && (
              <div className="relative">
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                  {notifications.length}
                </span>
                <button 
                  onClick={() => alert(`Notificaciones recientes:\n\n${notifications.map(n => `- ${n.message}`).join('\n')}`)}
                  className="p-2 text-slate-400 hover:text-white border border-slate-800 rounded-lg bg-slate-900/50"
                  title="Ver Notificaciones"
                >
                  <Flame className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Brand Dropdown Select */}
            <div className="relative">
              <button
                onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 hover:text-white hover:border-brand-primary transition-all duration-200 focus:outline-none"
              >
                {activeBrand?.logoUrl ? (
                  <img src={activeBrand.logoUrl} alt={activeBrand.name} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-brand-primary flex items-center justify-center font-bold text-slate-950 text-xs">B</div>
                )}
                <span className="font-semibold">{activeBrand?.name || 'Seleccionar Marca'}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {brandDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-slate-900 border border-slate-800 shadow-xl z-50 py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cambiar de Cocina</p>
                  </div>
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleBrandChange(b.id)}
                      className={`flex items-center w-full px-3 py-2.5 text-sm transition-all duration-200 hover:bg-slate-800 text-left gap-3 ${
                        activeBrand?.id === b.id ? 'text-brand-primary bg-slate-800/40 font-bold' : 'text-slate-300'
                      }`}
                    >
                      {b.logoUrl ? (
                        <img src={b.logoUrl} alt={b.name} className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">B</div>
                      )}
                      <div className="flex-1 truncate">
                        <p className="truncate font-semibold">{b.name}</p>
                      </div>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.primaryColor }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
