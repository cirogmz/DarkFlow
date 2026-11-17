'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  FileText,
  Printer,
  Copy,
  Download,
  Calendar,
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Wallet
} from 'lucide-react';

interface CorporateAccount {
  id: string;
  brandId: string;
  accountNumber: string;
  companyName: string;
  tradeName?: string | null;
  rfc?: string | null;
  taxRegime?: string | null;
  cfdiUse?: string | null;
  billingAddress?: string | null;
  billingEmail?: string | null;
  contactName: string;
  contactPhone: string;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  paymentTermsDays: number;
  status: string; // ACTIVE, SUSPENDED, OVER_LIMIT, CLOSED
  authorizedRepin?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: {
    vouchers: number;
    payments: number;
    statements: number;
    orders: number;
  };
}

interface CorporateVoucher {
  id: string;
  voucherFolio: string;
  amount: number;
  signedByName: string;
  employeeId?: string | null;
  department?: string | null;
  status: string;
  createdAt: string;
  account: {
    id: string;
    accountNumber: string;
    companyName: string;
    rfc?: string | null;
    creditLimit: number;
    currentBalance: number;
  };
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
  } | null;
  statement?: {
    id: string;
    statementFolio: string;
    status: string;
  } | null;
}

interface CorporatePayment {
  id: string;
  receiptFolio: string;
  amount: number;
  paymentMethod: string;
  bankReference?: string | null;
  balanceBefore: number;
  balanceAfter: number;
  receivedByName?: string | null;
  notes?: string | null;
  createdAt: string;
  account: {
    id: string;
    accountNumber: string;
    companyName: string;
    rfc?: string | null;
  };
}

interface CorporateStatement {
  id: string;
  statementFolio: string;
  periodStart: string;
  periodEnd: string;
  previousBalance: number;
  chargesAmount: number;
  paymentsAmount: number;
  closingBalance: number;
  dueDate: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  vouchers?: Array<{
    id: string;
    voucherFolio: string;
    amount: number;
    signedByName: string;
    createdAt: string;
  }>;
}

interface CorporateCreditTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBrand: any;
  addNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function CorporateCreditTab({ activeBrand, addNotification }: CorporateCreditTabProps) {
  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    if (addNotification) {
      addNotification(message, type);
    } else {
      if (type === 'error' || type === 'warning') {
        alert(message);
      }
    }
  }, [addNotification]);

  const [subTab, setSubTab] = useState<'ACCOUNTS' | 'VOUCHERS' | 'PAYMENTS' | 'STATEMENTS'>('ACCOUNTS');

  // Accounts state
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [metrics, setMetrics] = useState({
    totalAccounts: 0,
    totalReceivables: 0,
    totalCreditLimit: 0,
    activeAccounts: 0,
    overLimitAccounts: 0,
    availableTotal: 0,
  });
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Vouchers state
  const [vouchers, setVouchers] = useState<CorporateVoucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherStatusFilter, setVoucherStatusFilter] = useState('ALL');

  // Payments state
  const [payments, setPayments] = useState<CorporatePayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Statements state
  const [statements, setStatements] = useState<CorporateStatement[]>([]);
  const [loadingStatements, setLoadingStatements] = useState(false);

  // Modals state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    companyName: '',
    tradeName: '',
    rfc: '',
    taxRegime: '601',
    cfdiUse: 'G03',
    billingAddress: '',
    billingEmail: '',
    contactName: '',
    contactPhone: '',
    creditLimit: 15000,
    paymentTermsDays: 15,
    authorizedRepin: '',
    notes: '',
  });

  // Modal Abono / Pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<CorporateAccount | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'SPEI',
    bankReference: '',
    notes: '',
  });

  // Modal Corte / Estado de Cuenta
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedAccountForStatement, setSelectedAccountForStatement] = useState<CorporateAccount | null>(null);
  const [statementForm, setStatementForm] = useState({
    periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Modal Visor Ticket / Pagaré / Estado de cuenta
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketContent, setTicketContent] = useState('');
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Cargar Cuentas Corporativas
  const loadAccounts = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingAccounts(true);
    try {
      const q = new URLSearchParams();
      q.set('brandId', activeBrand.id);
      if (statusFilter !== 'ALL') q.set('status', statusFilter);
      if (searchQuery.trim()) q.set('search', searchQuery.trim());

      const res = await fetch(`/api/corporate/accounts?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        notify(data.error || 'Error al cargar cuentas corporativas', 'error');
      }
    } catch {
      notify('Error al conectar con el servidor', 'error');
    } finally {
      setLoadingAccounts(false);
    }
  }, [activeBrand?.id, statusFilter, searchQuery, notify]);

  // Cargar Vales / Pagarés
  const loadVouchers = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingVouchers(true);
    try {
      const q = new URLSearchParams();
      q.set('brandId', activeBrand.id);
      if (voucherStatusFilter !== 'ALL') q.set('status', voucherStatusFilter);

      const res = await fetch(`/api/corporate/vouchers?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setVouchers(data.vouchers || []);
      } else {
        notify(data.error || 'Error al cargar pagarés de crédito', 'error');
      }
    } catch {
      notify('Error al conectar con el servidor', 'error');
    } finally {
      setLoadingVouchers(false);
    }
  }, [activeBrand?.id, voucherStatusFilter, notify]);

  // Cargar Abonos / Pagos
  const loadPayments = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingPayments(true);
    try {
      const res = await fetch(`/api/corporate/payments?brandId=${activeBrand.id}`);
      const data = await res.json();
      if (res.ok) {
        setPayments(data.payments || []);
      } else {
        notify(data.error || 'Error al cargar abonos', 'error');
      }
    } catch {
      notify('Error al conectar con el servidor', 'error');
    } finally {
      setLoadingPayments(false);
    }
  }, [activeBrand?.id, notify]);

  useEffect(() => {
    if (subTab === 'ACCOUNTS') {
      loadAccounts();
    } else if (subTab === 'VOUCHERS') {
      loadVouchers();
    } else if (subTab === 'PAYMENTS') {
      loadPayments();
    }
  }, [subTab, loadAccounts, loadVouchers, loadPayments]);

  // Abrir Modal de Alta
  const openNewAccountModal = () => {
    setEditingAccountId(null);
    setAccountForm({
      companyName: '',
      tradeName: '',
      rfc: '',
      taxRegime: '601',
      cfdiUse: 'G03',
      billingAddress: '',
      billingEmail: '',
      contactName: '',
      contactPhone: '',
      creditLimit: 15000,
      paymentTermsDays: 15,
      authorizedRepin: '',
      notes: '',
    });
    setShowAccountModal(true);
  };

  // Abrir Modal de Edición
  const openEditAccountModal = (acc: CorporateAccount) => {
    setEditingAccountId(acc.id);
    setAccountForm({
      companyName: acc.companyName,
      tradeName: acc.tradeName || '',
      rfc: acc.rfc || '',
      taxRegime: acc.taxRegime || '601',
      cfdiUse: acc.cfdiUse || 'G03',
      billingAddress: acc.billingAddress || '',
      billingEmail: acc.billingEmail || '',
      contactName: acc.contactName,
      contactPhone: acc.contactPhone,
      creditLimit: acc.creditLimit,
      paymentTermsDays: acc.paymentTermsDays,
      authorizedRepin: acc.authorizedRepin || '',
      notes: acc.notes || '',
    });
    setShowAccountModal(true);
  };

  // Guardar Cuenta Corporativa
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.companyName.trim() || !accountForm.contactName.trim() || !accountForm.contactPhone.trim()) {
      notify('Por favor completa los campos requeridos: Razón Social, Contacto y Teléfono.', 'warning');
      return;
    }

    try {
      const url = editingAccountId ? `/api/corporate/accounts/${editingAccountId}` : '/api/corporate/accounts';
      const method = editingAccountId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrand.id,
          ...accountForm,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        notify(data.message || 'Cuenta corporativa guardada con éxito', 'success');
        setShowAccountModal(false);
        loadAccounts();
      } else {
        notify(data.error || 'Error al guardar cuenta corporativa', 'error');
      }
    } catch {
      notify('Error al procesar la solicitud', 'error');
    }
  };

  // Registrar Abono
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForPayment) return;
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      notify('Ingresa un monto válido mayor a cero', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/corporate/accounts/${selectedAccountForPayment.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: paymentForm.paymentMethod,
          bankReference: paymentForm.bankReference,
          notes: paymentForm.notes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        notify(data.message || 'Abono registrado correctamente', 'success');
        setShowPaymentModal(false);
        loadAccounts();
        if (subTab === 'PAYMENTS') loadPayments();
      } else {
        notify(data.error || 'Error al registrar abono', 'error');
      }
    } catch {
      notify('Error al procesar el abono', 'error');
    }
  };

  // Generar Estado de Cuenta
  const handleGenerateStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForStatement) return;

    try {
      const res = await fetch(`/api/corporate/accounts/${selectedAccountForStatement.id}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statementForm),
      });

      const data = await res.json();
      if (res.ok) {
        notify(data.message || 'Estado de cuenta generado con éxito', 'success');
        setShowStatementModal(false);
        // Previsualizar el estado de cuenta recién generado
        if (data.statement?.id) {
          viewStatementPrint(data.statement.id, data.statement.statementFolio);
        }
        loadAccounts();
      } else {
        notify(data.error || 'Error al generar estado de cuenta', 'error');
      }
    } catch {
      notify('Error al generar corte de estado de cuenta', 'error');
    }
  };

  // Ver Ticket Térmico de Vale / Pagaré
  const viewVoucherPrint = async (voucherId: string, folio: string) => {
    setLoadingTicket(true);
    setTicketTitle(`Pagaré / Vale de Crédito ${folio}`);
    setShowTicketModal(true);
    try {
      const res = await fetch(`/api/corporate/vouchers/${voucherId}/print`);
      const data = await res.json();
      if (res.ok) {
        setTicketContent(data.ticket);
      } else {
        notify(data.error || 'Error al cargar pagaré térmico', 'error');
      }
    } catch {
      notify('Error al conectar para imprimir pagaré', 'error');
    } finally {
      setLoadingTicket(false);
    }
  };

  // Ver Reporte de Estado de Cuenta
  const viewStatementPrint = async (statementId: string, folio: string) => {
    setLoadingTicket(true);
    setTicketTitle(`Estado de Cuenta ${folio}`);
    setShowTicketModal(true);
    try {
      const res = await fetch(`/api/corporate/statements/${statementId}/print`);
      const data = await res.json();
      if (res.ok) {
        setTicketContent(data.report);
      } else {
        notify(data.error || 'Error al cargar reporte de estado de cuenta', 'error');
      }
    } catch {
      notify('Error al conectar para visualizar estado de cuenta', 'error');
    } finally {
      setLoadingTicket(false);
    }
  };

  // Copiar al portapapeles
  const copyToClipboard = () => {
    if (!ticketContent) return;
    navigator.clipboard.writeText(ticketContent);
    notify('Documento copiado al portapapeles', 'success');
  };

  // Descargar archivo .txt
  const downloadAsTextFile = () => {
    if (!ticketContent) return;
    const blob = new Blob([ticketContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ticketTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Archivo descargado con éxito', 'success');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Activa</span>;
      case 'OVER_LIMIT':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-950/60 text-rose-400 border border-rose-800/60 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Límite Excedido</span>;
      case 'SUSPENDED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-950/60 text-amber-400 border border-amber-800/60 flex items-center gap-1"><Clock className="h-3 w-3" /> Suspendida</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">Cerrada</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Cuentas por Cobrar Totales */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuentas por Cobrar (AR)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">
              ${metrics.totalReceivables.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-semibold">MXN</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Saldo deudor acumulado en cartera
          </p>
        </div>

        {/* KPI 2: Límite Global Autorizado */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Línea de Crédito Global</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              ${metrics.totalCreditLimit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-semibold">MXN</span>
          </div>
          <p className="text-xs text-emerald-400 mt-1 font-medium">
            ${metrics.availableTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN disponible
          </p>
        </div>

        {/* KPI 3: Empresas Activas */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuentas Registradas</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{metrics.totalAccounts}</span>
            <span className="text-xs text-emerald-400 font-bold">({metrics.activeAccounts} activas)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Clientes B2B con crédito autorizado</p>
        </div>

        {/* KPI 4: Cuentas en Riesgo / Límite */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alerta de Límite / Riesgo</span>
            <div className={`p-2 rounded-xl border ${metrics.overLimitAccounts > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${metrics.overLimitAccounts > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {metrics.overLimitAccounts}
            </span>
            <span className="text-xs text-slate-500 font-semibold">empresas</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {metrics.overLimitAccounts > 0 ? 'Requiere gestión de cobranza inmediata' : 'Todas las cuentas dentro de su margen'}
          </p>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-3">
        <div className="flex gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('ACCOUNTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'ACCOUNTS' ? 'bg-brand-primary text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="h-4 w-4" /> Cuentas & Saldos
          </button>
          <button
            onClick={() => setSubTab('VOUCHERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'VOUCHERS' ? 'bg-brand-primary text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" /> Pagarés & Vales
          </button>
          <button
            onClick={() => setSubTab('PAYMENTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'PAYMENTS' ? 'bg-brand-primary text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="h-4 w-4" /> Abonos & Cobranza
          </button>
        </div>

        {subTab === 'ACCOUNTS' && (
          <button
            onClick={openNewAccountModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-primary hover:brightness-110 text-slate-950 transition flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Nueva Cuenta Corporativa
          </button>
        )}
      </div>

      {/* SUBTAB 1: CUENTAS CORPORATIVAS & SALDOS */}
      {subTab === 'ACCOUNTS' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por razón social, nombre comercial, RFC, no. cuenta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-brand-primary/50 cursor-pointer"
            >
              <option value="ALL">Todos los Estatus</option>
              <option value="ACTIVE">Activas</option>
              <option value="OVER_LIMIT">Límite Excedido</option>
              <option value="SUSPENDED">Suspendidas</option>
              <option value="CLOSED">Cerradas</option>
            </select>
            <button
              onClick={loadAccounts}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Refrescar"
            >
              <RefreshCw className={`h-4 w-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tabla de Cuentas */}
          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cuenta / Razón Social</th>
                    <th className="py-3 px-4">Contacto & RFC</th>
                    <th className="py-3 px-4">Límite de Crédito</th>
                    <th className="py-3 px-4">Saldo Actual</th>
                    <th className="py-3 px-4">Uso de Línea</th>
                    <th className="py-3 px-4">Plazo</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        {loadingAccounts ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-brand-primary" />
                            <p className="text-xs">Cargando cuentas corporativas...</p>
                          </div>
                        ) : (
                          'No se encontraron cuentas corporativas registradas.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => {
                      const usagePct = acc.creditLimit > 0 ? Math.min(100, Math.round((acc.currentBalance / acc.creditLimit) * 100)) : 0;
                      return (
                        <tr key={acc.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-base">{acc.companyName}</div>
                            <div className="text-xs text-brand-primary font-mono mt-0.5">[{acc.accountNumber}] {acc.tradeName && `• ${acc.tradeName}`}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="text-slate-200 font-medium">{acc.contactName}</div>
                            <div className="text-slate-500">{acc.contactPhone}</div>
                            {acc.rfc && <div className="text-slate-400 font-mono mt-0.5">RFC: {acc.rfc}</div>}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            ${acc.creditLimit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span className={acc.currentBalance > 0 ? 'text-amber-400' : 'text-slate-400'}>
                              ${acc.currentBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 min-w-[140px]">
                            <div className="flex items-center justify-between text-xs font-mono mb-1">
                              <span className={usagePct >= 90 ? 'text-rose-400 font-bold' : 'text-slate-400'}>{usagePct}%</span>
                              <span className="text-slate-500 text-[10px]">Disp: ${acc.availableCredit.toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  usagePct >= 95 ? 'bg-rose-500' : usagePct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300">
                            {acc.paymentTermsDays} días
                          </td>
                          <td className="py-3.5 px-4">
                            {getStatusBadge(acc.status)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedAccountForPayment(acc);
                                  setPaymentForm({
                                    amount: acc.currentBalance > 0 ? acc.currentBalance.toString() : '1000',
                                    paymentMethod: 'SPEI',
                                    bankReference: '',
                                    notes: '',
                                  });
                                  setShowPaymentModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                                title="Registrar Abono"
                              >
                                Abonar
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAccountForStatement(acc);
                                  setShowStatementModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                                title="Generar Corte / Estado de Cuenta"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEditAccountModal(acc)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                                title="Editar Cuenta"
                              >
                                <FileText className="h-4 w-4" />
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

      {/* SUBTAB 2: VALES & PAGARÉS */}
      {subTab === 'VOUCHERS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <select
              value={voucherStatusFilter}
              onChange={(e) => setVoucherStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-brand-primary/50 cursor-pointer"
            >
              <option value="ALL">Todos los Vales</option>
              <option value="PENDING">Pendientes de Pago</option>
              <option value="SETTLED">Liquidados / Pagados</option>
              <option value="INVOICED">Facturados</option>
            </select>
            <button
              onClick={loadVouchers}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`h-4 w-4 ${loadingVouchers ? 'animate-spin' : ''}`} /> Refrescar
            </button>
          </div>

          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Folio Pagaré</th>
                    <th className="py-3 px-4">Comanda</th>
                    <th className="py-3 px-4">Cuenta / Empresa</th>
                    <th className="py-3 px-4">Firmante / Nómina</th>
                    <th className="py-3 px-4">Depto</th>
                    <th className="py-3 px-4">Monto</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        {loadingVouchers ? 'Cargando vales...' : 'No se han registrado vales de crédito.'}
                      </td>
                    </tr>
                  ) : (
                    vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-brand-primary">
                          {v.voucherFolio}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs">
                          {v.order ? (
                            <span className="text-white font-bold">#{v.order.orderNumber}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">{v.account.companyName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">[{v.account.accountNumber}]</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-200">
                          <div>{v.signedByName}</div>
                          {v.employeeId && <div className="text-slate-500 font-mono text-[10px]">ID: {v.employeeId}</div>}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {v.department || 'General'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                          ${v.amount.toFixed(2)} MXN
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {new Date(v.createdAt).toLocaleDateString('es-MX')}
                        </td>
                        <td className="py-3.5 px-4">
                          {v.status === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/60">Pendiente</span>
                          ) : v.status === 'SETTLED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">Liquidado</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{v.status}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => viewVoucherPrint(v.id, v.voucherFolio)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer flex items-center gap-1 ml-auto"
                            title="Imprimir Pagaré"
                          >
                            <Printer className="h-3.5 w-3.5 text-brand-primary" /> Pagaré
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: ABONOS & COBRANZA */}
      {subTab === 'PAYMENTS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-300">Historial de Cobranza & Abonos Recibidos</h4>
            <button
              onClick={loadPayments}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`h-4 w-4 ${loadingPayments ? 'animate-spin' : ''}`} /> Refrescar
            </button>
          </div>

          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Recibo</th>
                    <th className="py-3 px-4">Cuenta / Empresa</th>
                    <th className="py-3 px-4">Monto Abono</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4">Referencia Bancaria</th>
                    <th className="py-3 px-4">Saldo Anterior</th>
                    <th className="py-3 px-4">Nuevo Saldo</th>
                    <th className="py-3 px-4">Fecha / Recibido Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        {loadingPayments ? 'Cargando abonos...' : 'No se han registrado abonos todavía.'}
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {p.receiptFolio}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">{p.account.companyName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">[{p.account.accountNumber}]</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-base">
                          +${p.amount.toFixed(2)} MXN
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-slate-300">
                          {p.paymentMethod}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                          {p.bankReference || 'TRANSFERENCIA DIRECTA'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                          ${p.balanceBefore.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-white">
                          ${p.balanceAfter.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div className="text-slate-300">{new Date(p.createdAt).toLocaleString('es-MX', { hour12: false })}</div>
                          <div className="text-slate-500 text-[10px]">{p.receivedByName || 'Administrador'}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ALTA / EDICIÓN DE CUENTA CORPORATIVA */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand-primary" />
                {editingAccountId ? 'Editar Cuenta Corporativa' : 'Nueva Cuenta de Crédito Corporativo'}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Razón Social *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Tecnologías del Norte S.A. de C.V."
                    value={accountForm.companyName}
                    onChange={(e) => setAccountForm({ ...accountForm, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    placeholder="Ej. TecNorte"
                    value={accountForm.tradeName}
                    onChange={(e) => setAccountForm({ ...accountForm, tradeName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">RFC SAT</label>
                  <input
                    type="text"
                    maxLength={13}
                    placeholder="TNO180420ABC"
                    value={accountForm.rfc}
                    onChange={(e) => setAccountForm({ ...accountForm, rfc: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Régimen Fiscal</label>
                  <input
                    type="text"
                    placeholder="601 - General Ley"
                    value={accountForm.taxRegime}
                    onChange={(e) => setAccountForm({ ...accountForm, taxRegime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Uso de CFDI</label>
                  <input
                    type="text"
                    placeholder="G03 - Gastos en general"
                    value={accountForm.cfdiUse}
                    onChange={(e) => setAccountForm({ ...accountForm, cfdiUse: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Contacto Principal / RH / Finanzas *</label>
                  <input
                    type="text"
                    required
                    placeholder="Lic. Mariana Morales"
                    value={accountForm.contactName}
                    onChange={(e) => setAccountForm({ ...accountForm, contactName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Teléfono Contacto *</label>
                  <input
                    type="tel"
                    required
                    placeholder="8112345678"
                    value={accountForm.contactPhone}
                    onChange={(e) => setAccountForm({ ...accountForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Email de Facturación / Cobranza</label>
                  <input
                    type="email"
                    placeholder="facturas@empresa.com"
                    value={accountForm.billingEmail}
                    onChange={(e) => setAccountForm({ ...accountForm, billingEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Dirección Fiscal / Entrega</label>
                  <input
                    type="text"
                    placeholder="Av. Revolución 1234, Col. Centro, Monterrey NL"
                    value={accountForm.billingAddress}
                    onChange={(e) => setAccountForm({ ...accountForm, billingAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">Límite de Crédito ($ MXN) *</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={accountForm.creditLimit}
                    onChange={(e) => setAccountForm({ ...accountForm, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-400 font-mono font-bold focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Días de Plazo (Corte)</label>
                  <select
                    value={accountForm.paymentTermsDays}
                    onChange={(e) => setAccountForm({ ...accountForm, paymentTermsDays: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none text-sm cursor-pointer"
                  >
                    <option value={7}>7 días (Semanal)</option>
                    <option value={15}>15 días (Quincenal)</option>
                    <option value={30}>30 días (Mensual)</option>
                    <option value={45}>45 días (Especial)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">PIN Autorización (Opcional)</label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Ej. 1234"
                    value={accountForm.authorizedRepin}
                    onChange={(e) => setAccountForm({ ...accountForm, authorizedRepin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Notas Administrativas</label>
                <textarea
                  rows={2}
                  placeholder="Instrucciones para autorizar pedidos o áreas asignadas..."
                  value={accountForm.notes}
                  onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-brand-primary/50 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-primary text-slate-950 hover:brightness-110 transition cursor-pointer font-bold text-xs shadow-lg"
                >
                  {editingAccountId ? 'Actualizar Cuenta' : 'Crear Cuenta Corporativa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR ABONO / PAGO */}
      {showPaymentModal && selectedAccountForPayment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-400" /> Registrar Abono a Crédito
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Empresa:</span>
                <span className="font-bold text-white">{selectedAccountForPayment.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cuenta:</span>
                <span className="font-mono text-brand-primary font-bold">[{selectedAccountForPayment.accountNumber}]</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Saldo Deudor Actual:</span>
                <span className="font-mono font-bold text-amber-400">
                  ${selectedAccountForPayment.currentBalance.toFixed(2)} MXN
                </span>
              </div>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1">Monto del Abono ($ MXN) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Método de Pago</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none cursor-pointer text-sm"
                >
                  <option value="SPEI">Transferencia Electrónica (SPEI)</option>
                  <option value="TRANSFER">Transferencia Misma Plaza</option>
                  <option value="CHECK">Cheque Nominativo</option>
                  <option value="CASH">Efectivo en Caja</option>
                  <option value="CARD">Tarjeta de Débito / Crédito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Referencia Bancaria / No. Cheque</label>
                <input
                  type="text"
                  placeholder="Ej. Rastreo SPEI 012180... o Folio Cheque"
                  value={paymentForm.bankReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankReference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Notas / Observaciones</label>
                <input
                  type="text"
                  placeholder="Ej. Pago parcial quincena 1..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none text-sm"
                />
              </div>

              {/* Cálculo en vivo de nuevo saldo */}
              {parseFloat(paymentForm.amount) > 0 && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex justify-between items-center text-xs">
                  <span className="text-emerald-300 font-medium">Saldo Restante Proyectado:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ${Math.max(0, selectedAccountForPayment.currentBalance - (parseFloat(paymentForm.amount) || 0)).toFixed(2)} MXN
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer font-bold text-xs shadow-lg"
                >
                  Registrar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GENERAR CORTE / ESTADO DE CUENTA */}
      {showStatementModal && selectedAccountForStatement && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-primary" /> Generar Corte / Estado de Cuenta
              </h3>
              <button
                onClick={() => setShowStatementModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div><strong className="text-white">Empresa:</strong> {selectedAccountForStatement.companyName}</div>
              <div><strong className="text-white">Plazo de Pago:</strong> {selectedAccountForStatement.paymentTermsDays} días naturales tras corte</div>
              <div><strong className="text-white">Saldo Actual en Cartera:</strong> ${selectedAccountForStatement.currentBalance.toFixed(2)} MXN</div>
            </div>

            <form onSubmit={handleGenerateStatement} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Fecha Inicio Periodo</label>
                  <input
                    type="date"
                    required
                    value={statementForm.periodStart}
                    onChange={(e) => setStatementForm({ ...statementForm, periodStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Fecha Fin Periodo</label>
                  <input
                    type="date"
                    required
                    value={statementForm.periodEnd}
                    onChange={(e) => setStatementForm({ ...statementForm, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Notas / Observaciones del Corte</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Corte mensual correspondiente a noviembre 2026..."
                  value={statementForm.notes}
                  onChange={(e) => setStatementForm({ ...statementForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStatementModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-primary text-slate-950 hover:brightness-110 transition cursor-pointer font-bold text-xs shadow-lg"
                >
                  Generar Estado de Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VISOR DE PAGARÉ TÉRMICO / REPORTE DE ESTADO DE CUENTA */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="h-5 w-5 text-brand-primary" /> {ticketTitle}
              </h3>
              <button
                onClick={() => setShowTicketModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800">
              {loadingTicket ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-brand-primary" />
                  <p className="text-xs text-slate-400">Generando documento...</p>
                </div>
              ) : (
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed select-all">
                  {ticketContent}
                </pre>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  disabled={!ticketContent || loadingTicket}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar Texto
                </button>
                <button
                  onClick={downloadAsTextFile}
                  disabled={!ticketContent || loadingTicket}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar (.txt)
                </button>
              </div>

              <button
                onClick={() => setShowTicketModal(false)}
                className="px-4 py-1.5 rounded-lg bg-brand-primary text-slate-950 font-bold text-xs hover:brightness-110 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
