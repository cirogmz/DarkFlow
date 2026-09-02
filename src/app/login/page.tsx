'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Server, ShieldCheck, Flame, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const loadDemoUser = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  const demoAccounts = [
    { name: 'Super Admin', email: 'admin@darkflow.com', pass: 'admin123', icon: ShieldCheck, desc: 'Control de 3 marcas, KPIS, inventario global.' },
    { name: 'Gerente Marca', email: 'manager@darkflow.com', pass: 'manager123', icon: Server, desc: 'Acceso a Burger Peak y Taco Express.' },
    { name: 'Cocinero (KDS)', email: 'cocina@darkflow.com', pass: 'cocina123', icon: Flame, desc: 'Visualiza órdenes de Burger Peak en tiempo real.' },
    { name: 'Cajero / POS', email: 'cajero@darkflow.com', pass: 'cajero123', icon: User, desc: 'Crea pedidos en POS y gestiona caja en 3 marcas.' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 flex-col md:flex-row">
      {/* Left panel (Hero Branding) */}
      <div className="md:w-1/2 flex flex-col justify-center items-start p-12 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 border-b md:border-b-0 md:border-r border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500 via-emerald-500 to-red-500 blur-3xl"></div>
        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/40 text-sm font-semibold text-amber-500">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            Dark Kitchen Management System
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Control integral de tu <span className="text-amber-500 bg-clip-text">cocina fantasma</span>.
          </h1>
          <p className="text-slate-400 leading-relaxed text-base">
            DarkFlow Manager unifica las operaciones de tus marcas de comida, centralizando ventas en POS, KDS para cocina, inventario físico de insumos y asignación de repartidores en un solo flujo eficiente.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div>
              <p className="text-2xl font-bold text-white">3 Marcas</p>
              <p className="text-xs text-slate-500">Soportadas en MVP</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">100% Online</p>
              <p className="text-xs text-slate-500">Operaciones en la nube</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel (Form & Demo Users) */}
      <div className="md:w-1/2 flex flex-col justify-center p-8 md:p-16 bg-slate-950 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
            <p className="text-sm text-slate-500 mt-2">Introduce tus datos administrativos para acceder al sistema.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-sm text-red-400 font-medium animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@darkflow.com"
                  required
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-sm rounded-lg shadow-lg hover:shadow-amber-500/10 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></span>
              ) : (
                'Entrar al Dashboard'
              )}
            </button>
          </form>

          {/* Quick Demo Access Credentials */}
          <div className="pt-6 border-t border-slate-900">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Acceso Rápido Demo (MVP)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoAccounts.map((acc) => {
                const Icon = acc.icon;
                return (
                  <button
                    key={acc.name}
                    type="button"
                    onClick={() => loadDemoUser(acc.email, acc.pass)}
                    className="flex flex-col items-start p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-left transition-all duration-200 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs group-hover:text-amber-500">
                      <Icon className="h-4 w-4 text-slate-400 group-hover:text-amber-500" />
                      {acc.name}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">{acc.desc}</p>
                    <p className="text-[9px] text-slate-400 mt-2 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                      pw: {acc.pass}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
