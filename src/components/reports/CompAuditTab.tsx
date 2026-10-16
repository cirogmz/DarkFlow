'use client';

import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Users, 
  Crown, 
  FlaskConical, 
  AlertCircle, 
  DollarSign, 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  RefreshCw, 
  ShieldCheck, 
  ChefHat, 
  PieChart 
} from 'lucide-react';

interface CompOrder {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  compType: string;
  compReason?: string | null;
  compBeneficiaryName?: string | null;
  compApprovedByName?: string | null;
  compApprovedAt?: string | null;
  compFoodCost?: number | null;
  createdAt: string;
  table?: { number: string; name: string } | null;
  waiter?: { name: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    product: { name: string; price: number };
  }>;
}

interface CompStats {
  totalOrders: number;
  totalRetailComped: number;
  totalFoodCostAbsorbed: number;
  typeBreakdown: Record<string, { count: number; retail: number; cost: number }>;
  supervisors: Array<{ name: string; count: number; totalRetail: number; totalCost: number }>;
}

export default function CompAuditTab() {
  const [orders, setOrders] = useState<CompOrder[]>([]);
  const [stats, setStats] = useState<CompStats>({
    totalOrders: 0,
    totalRetailComped: 0,
    totalFoodCostAbsorbed: 0,
    typeBreakdown: {},
    supervisors: [],
  });
  const [loading, setLoading] = useState(true);
  const [compTypeFilter, setCompTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchCompData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (compTypeFilter !== 'ALL') params.append('compType', compTypeFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/orders/comp?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error('Error fetching comp audit data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompData();
  }, [compTypeFilter, startDate, endDate]);

  const handleExportCsv = () => {
    if (orders.length === 0) return;

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'Folio;Fecha;Hora;Tipo Cortesía;Beneficiario;Autorizado Por;Mesa;Platillos;Valor Carta ($);Food Cost Real ($);Motivo\n';

    orders.forEach((o) => {
      const date = new Date(o.createdAt);
      const fechaStr = date.toLocaleDateString('es-MX');
      const horaStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const platillos = o.items.map((i) => `${i.quantity}x ${i.product.name}`).join(' | ');

      csvContent += `"${o.orderNumber}";"${fechaStr}";"${horaStr}";"${o.compType}";"${o.compBeneficiaryName || 'N/A'}";"${o.compApprovedByName || 'N/A'}";"${o.table?.number || 'Mostrador'}";"${platillos}";${(o.total || o.subtotal || 0).toFixed(2)};${(o.compFoodCost || 0).toFixed(2)};"${o.compReason || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Auditoria_Cortesias_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCompTypeBadge = (type: string) => {
    switch (type) {
      case 'STAFF_MEAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Comida de Personal</span>;
      case 'VIP_COURTESY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Cortesía VIP / Casa</span>;
      case 'TASTING_SAMPLE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Degustación / Cocina</span>;
      case 'SERVICE_RECOVERY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Compensación Servicio</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Carta Bonificado</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">
              ${stats.totalRetailComped.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">{stats.totalOrders} comandas autorizadas</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Food Cost Real Absorbido</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">
              ${stats.totalFoodCostAbsorbed.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Costo de insumos descontados de almacén
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">% Absorción Costo</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-300">
              {stats.totalRetailComped > 0 
                ? `${Math.round((stats.totalFoodCostAbsorbed / stats.totalRetailComped) * 100)}%` 
                : '0%'}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Costo real vs precio venta</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Auditoría con PIN</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">
              100%
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              {stats.supervisors.length} supervisores autorizantes
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/50">
        <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por folio, beneficiario o supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Comp Type Filter */}
          <select
            value={compTypeFilter}
            onChange={(e) => setCompTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="ALL">Todos los Tipos de Cortesía</option>
            <option value="STAFF_MEAL">Comida de Personal (Staff Meal)</option>
            <option value="VIP_COURTESY">Cortesía VIP / Invitación Casa</option>
            <option value="TASTING_SAMPLE">Degustación / Cocina</option>
            <option value="SERVICE_RECOVERY">Compensación por Servicio</option>
          </select>
        </div>

        {/* Date Filter & Export */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
          />
          <span className="text-xs text-slate-500">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-primary"
          />

          <button
            onClick={fetchCompData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={orders.length === 0}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Folio / Fecha</th>
                <th className="py-3 px-4">Tipo de Cortesía</th>
                <th className="py-3 px-4">Beneficiario / Justificación</th>
                <th className="py-3 px-4">Autorizado Por</th>
                <th className="py-3 px-4">Platillos / Comanda</th>
                <th className="py-3 px-4 text-right">Valor Venta</th>
                <th className="py-3 px-4 text-right">Food Cost Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Gift className="h-10 w-10 mx-auto text-slate-600 mb-2 stroke-[1.5]" />
                    <p className="font-semibold text-slate-400">No hay registros de cortesías para los filtros seleccionados</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Las cortesías o comidas de personal autorizadas en POS o Comandero aparecerán aquí.
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Folio / Fecha */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-white">#{o.orderNumber}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(o.createdAt).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Tipo Cortesía */}
                    <td className="py-3 px-4">
                      {getCompTypeBadge(o.compType)}
                    </td>

                    {/* Beneficiario / Justificación */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">
                        {o.compBeneficiaryName || 'Destinatario general'}
                      </div>
                      {o.compReason && (
                        <div className="text-[10px] text-amber-300/80 mt-0.5">
                          {o.compReason}
                        </div>
                      )}
                    </td>

                    {/* Autorizado Por */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{o.compApprovedByName || 'Gerente de Turno'}</span>
                      </div>
                    </td>

                    {/* Platillos */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="text-slate-300 truncate" title={o.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}>
                        {o.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {o.table ? `Mesa ${o.table.number}` : 'Mostrador / Para Llevar'}
                      </div>
                    </td>

                    {/* Valor Venta */}
                    <td className="py-3 px-4 text-right font-bold text-white">
                      ${(o.total || o.subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Food Cost */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                      ${(o.compFoodCost || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
