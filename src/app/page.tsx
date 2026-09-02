'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  Smartphone,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

interface KPIState {
  todaySales: number;
  todayOrders: number;
  ticketAverage: number;
  avgDeliveryTime: number;
}

interface ChartState {
  hourlyData: Array<{ hour: string; ventas: number }>;
  platformData: Array<{ name: string; value: number }>;
  topProducts: Array<{ name: string; quantity: number; sales: number }>;
  weeklyData: Array<{ day: string; ventas: number; ordenes: number }>;
}

interface BrandComparison {
  brandName: string;
  primaryColor: string;
  totalSales: number;
  ordersCount: number;
  ticketAverage: number;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIState>({ todaySales: 0, todayOrders: 0, ticketAverage: 0, avgDeliveryTime: 25 });
  const [charts, setCharts] = useState<ChartState>({ hourlyData: [], platformData: [], topProducts: [], weeklyData: [] });
  const [comparison, setComparison] = useState<BrandComparison[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        if (data.kpis) setKpis(data.kpis);
        if (data.charts) setCharts(data.charts);
        if (data.brandComparison) setComparison(data.brandComparison);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const COLORS = ['#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

  if (loading) {
    return (
      <DashboardContainer>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center flex-col gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-brand-primary"></div>
          <p className="text-sm text-slate-400">Cargando métricas de la cocina...</p>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Today Sales */}
          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Ventas de Hoy</p>
              <h3 className="text-2xl font-black text-white mt-1">${kpis.todaySales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1 font-medium">
                <TrendingUp className="h-3 w-3" /> +12% vs ayer
              </p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Orders Count */}
          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Pedidos Completados</p>
              <h3 className="text-2xl font-black text-white mt-1">{kpis.todayOrders}</h3>
              <p className="text-xs text-slate-500 mt-1">Órdenes entregadas hoy</p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: Ticket Average */}
          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Ticket Promedio</p>
              <h3 className="text-2xl font-black text-white mt-1">${kpis.ticketAverage.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-500 mt-1">Promedio histórico</p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>

          {/* Card 4: Avg Delivery Time */}
          <div className="glass-panel rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-sm font-semibold text-slate-400">Tiempo de Entrega</p>
              <h3 className="text-2xl font-black text-white mt-1">{kpis.avgDeliveryTime} min</h3>
              <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1 font-medium">
                Dentro del límite ideal (30m)
              </p>
            </div>
            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Charts & Top Products Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Sales Trend Chart */}
          <div className="glass-panel rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white">Ventas por Hora (Hoy)</h4>
              <span className="text-xs text-slate-400 font-semibold px-2 py-1 bg-slate-800 rounded">Actualizado en tiempo real</span>
            </div>
            <div className="h-[280px]">
              {charts.hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="ventas" name="Ventas ($)" stroke="var(--brand-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500 text-sm">Sin datos para graficar hoy</div>
              )}
            </div>
          </div>

          {/* Sales by Platform */}
          <div className="glass-panel rounded-xl p-5 shadow-lg space-y-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white">Ventas por Origen</h4>
              <Smartphone className="h-4 w-4 text-slate-400" />
            </div>
            <div className="h-[200px] relative flex-1">
              {charts.platformData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.platformData.filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {charts.platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value}`} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500 text-sm">Sin datos agregados</div>
              )}
            </div>
            {/* Legend indicators */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-xs">
              {charts.platformData.map((plat, idx) => (
                <div key={plat.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="text-slate-400 truncate">{plat.name}</span>
                  <span className="text-white font-bold ml-auto">${plat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly & Top Selling Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly evolution Line chart */}
          <div className="glass-panel rounded-xl p-5 shadow-lg space-y-4 lg:col-span-2">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white">Evolución de Ventas Semanal</h4>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line type="monotone" dataKey="ventas" name="Ventas ($)" stroke="var(--brand-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="ordenes" name="Pedidos" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="glass-panel rounded-xl p-5 shadow-lg space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white">Platos Más Vendidos</h4>
            </div>
            <div className="space-y-4 py-2">
              {charts.topProducts.length > 0 ? (
                charts.topProducts.map((prod) => (
                  <div key={prod.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-200 truncate max-w-[200px]">{prod.name}</span>
                      <span className="text-slate-400 text-xs font-bold">{prod.quantity} pzs / ${prod.sales.toFixed(2)}</span>
                    </div>
                    {/* Simulated bar */}
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-primary rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (prod.quantity / Math.max(...charts.topProducts.map(p => p.quantity))) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-[150px] items-center justify-center text-slate-500 text-sm">Cargando productos top...</div>
              )}
            </div>
          </div>
        </div>

        {/* Super Admin Comparison Grid */}
        {comparison && (
          <div className="space-y-4 pt-4 border-t border-slate-900">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white">Panel Comparativo Multimarca (Super Admin)</h3>
              <div className="p-1 rounded bg-slate-800 text-[10px] text-slate-400 font-bold flex items-center gap-1 border border-slate-700">
                <Info className="h-3 w-3" /> Privado
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {comparison.map((brand) => (
                <div key={brand.brandName} className="glass-panel rounded-xl p-5 border-l-4 shadow-lg space-y-3" style={{ borderLeftColor: brand.primaryColor }}>
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-white text-base">{brand.brandName}</h5>
                    <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ventas</p>
                      <p className="text-lg font-black text-white mt-0.5">${brand.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Órdenes</p>
                      <p className="text-lg font-black text-white mt-0.5">{brand.ordersCount}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-xs flex justify-between text-slate-400">
                    <span>Ticket Promedio</span>
                    <span className="font-bold text-white">${brand.ticketAverage.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
