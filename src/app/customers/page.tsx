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
  Coins,
  CreditCard,
  Wallet,
  QrCode,
  Lock,
  Unlock,
  History,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Cake,
  Gift,
  Award,
  Zap,
  Info,
  Download,
  Copy,
  Check
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { GiftCardDTO, GiftCardTransactionDTO, generateGiftCardCode } from '@/lib/giftCards';
import { WalletTransactionDTO } from '@/lib/wallet';
import {
  LOYALTY_TIERS,
  LoyaltyTierId,
  LoyaltyTierConfig,
  TierProgress,
  BirthdayAnalysis,
  TIER_ORDER,
} from '@/lib/loyaltyTiers';

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
  birthDate?: string | null;
  tier: string;
  pointsMultiplier: number;
  tierDiscountPct: number;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  walletBalance?: number;
  walletQrCode?: string | null;
  cashbackRatePct?: number | null;
  totalCashbackEarned?: number;
  totalCashbackSpent?: number;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name: string;
    primaryColor: string;
  } | null;
  orders: CustomerOrder[];
  tierConfig?: LoyaltyTierConfig;
  tierProgress?: TierProgress;
  birthdayInfo?: BirthdayAnalysis;
}

interface CRMStats {
  totalCustomers: number;
  vipCustomers: number;
  totalPoints: number;
  totalSpent: number;
  averageSpent: number;
  totalWalletBalance?: number;
  totalCashbackEarned?: number;
  totalCashbackSpent?: number;
  bronzeCount?: number;
  silverCount?: number;
  goldCount?: number;
  platinumCount?: number;
  birthdayCount?: number;
}

export default function CustomersPage() {
  const { activeBrand, addNotification } = useAppStore();
  const [activeMainTab, setActiveMainTab] = useState<'crm' | 'giftcards'>('crm');

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
  const [filterType, setFilterType] = useState<string>('all');

  // Gift Card State
  const [giftCards, setGiftCards] = useState<GiftCardDTO[]>([]);
  const [giftCardsSummary, setGiftCardsSummary] = useState({
    totalCards: 0,
    activeCards: 0,
    totalCirculatingBalance: 0,
  });
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardSearch, setGiftCardSearch] = useState('');
  const [giftCardStatusFilter, setGiftCardStatusFilter] = useState('ALL');

  // Gift Card Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [selectedCardForHistory, setSelectedCardForHistory] = useState<GiftCardDTO | null>(null);
  const [selectedCardForRecharge, setSelectedCardForRecharge] = useState<GiftCardDTO | null>(null);

  // Gift Card Forms
  const [issueForm, setIssueForm] = useState({
    code: '',
    initialBalance: 500,
    customerId: '',
    cardType: 'DIGITAL',
    pin: '',
    expiresAt: '',
    notes: '',
  });

  const [rechargeForm, setRechargeForm] = useState({
    code: '',
    amount: 200,
    paymentMethod: 'EFECTIVO',
    notes: '',
  });

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTierBenefitsModal, setShowTierBenefitsModal] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [selectedCustomerForWallet, setSelectedCustomerForWallet] = useState<Customer | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionDTO[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletRechargeForm, setWalletRechargeForm] = useState({
    amount: '',
    type: 'MANUAL_RECHARGE',
    reference: '',
    notes: '',
  });
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [walletFilterType, setWalletFilterType] = useState<string>('ALL');
  const [copiedQrCode, setCopiedQrCode] = useState(false);
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
    birthDate: '',
    tier: 'BRONZE',
    initialPoints: 0,
  });

  const fetchGiftCards = useCallback(async () => {
    if (!activeBrand?.id) return;
    try {
      setGiftCardLoading(true);
      const params = new URLSearchParams();
      params.append('brandId', activeBrand.id);
      if (giftCardSearch.trim()) params.append('search', giftCardSearch.trim());
      if (giftCardStatusFilter !== 'ALL') params.append('status', giftCardStatusFilter);

      const res = await fetch(`/api/gift-cards?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGiftCards(data.cards || []);
        if (data.summary) {
          setGiftCardsSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching gift cards:', err);
    } finally {
      setGiftCardLoading(false);
    }
  }, [activeBrand?.id, giftCardSearch, giftCardStatusFilter]);

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

  useEffect(() => {
    if (activeMainTab === 'giftcards') {
      fetchGiftCards();
    }
  }, [activeMainTab, fetchGiftCards]);

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
        birthDate: '',
        tier: 'BRONZE',
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
          birthDate: editingCustomer.birthDate,
          tier: editingCustomer.tier,
          pointsMultiplier: editingCustomer.pointsMultiplier,
          tierDiscountPct: editingCustomer.tierDiscountPct,
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

  const fetchCustomerWallet = async (customerId: string) => {
    setWalletLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/wallet`);
      const data = await res.json();
      if (res.ok && data.wallet) {
        setWalletTransactions(data.transactions || []);
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  walletBalance: data.wallet.walletBalance,
                  walletQrCode: data.wallet.walletQrCode,
                  cashbackRatePct: data.wallet.cashbackRatePct,
                  totalCashbackEarned: data.wallet.totalCashbackEarned,
                  totalCashbackSpent: data.wallet.totalCashbackSpent,
                }
              : c
          )
        );
        setSelectedCustomerForWallet((prev) =>
          prev && prev.id === customerId
            ? {
                ...prev,
                walletBalance: data.wallet.walletBalance,
                walletQrCode: data.wallet.walletQrCode,
                cashbackRatePct: data.wallet.cashbackRatePct,
                totalCashbackEarned: data.wallet.totalCashbackEarned,
                totalCashbackSpent: data.wallet.totalCashbackSpent,
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Error fetching customer wallet:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleRechargeWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForWallet) return;
    const numAmount = parseFloat(walletRechargeForm.amount);
    if (isNaN(numAmount) || numAmount === 0) {
      addNotification('Ingresa un monto válido diferente de cero', 'error');
      return;
    }

    setWalletSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomerForWallet.id}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          type: walletRechargeForm.type,
          reference: walletRechargeForm.reference,
          notes: walletRechargeForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar saldo');
      }

      addNotification(data.message || 'Saldo actualizado exitosamente', 'success');
      setWalletRechargeForm({
        amount: '',
        type: 'MANUAL_RECHARGE',
        reference: '',
        notes: '',
      });
      fetchCustomerWallet(selectedCustomerForWallet.id);
      fetchCustomers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      addNotification(msg, 'error');
    } finally {
      setWalletSubmitting(false);
    }
  };

  const handleIssueCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) {
      addNotification('Selecciona una marca activa', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrand.id,
          code: issueForm.code || undefined,
          initialBalance: issueForm.initialBalance,
          customerId: issueForm.customerId || undefined,
          cardType: issueForm.cardType,
          pin: issueForm.pin || undefined,
          expiresAt: issueForm.expiresAt || undefined,
          notes: issueForm.notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al emitir tarjeta');

      addNotification(`Tarjeta ${data.card.code} emitida exitosamente ($${data.card.balance.toFixed(2)})`, 'success');
      setShowIssueModal(false);
      setIssueForm({
        code: '',
        initialBalance: 500,
        customerId: '',
        cardType: 'DIGITAL',
        pin: '',
        expiresAt: '',
        notes: '',
      });
      fetchGiftCards();
    } catch (err: any) {
      addNotification(err.message || 'Error al emitir tarjeta', 'error');
    }
  };

  const handleRechargeCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/gift-cards/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rechargeForm.code,
          amount: rechargeForm.amount,
          paymentMethod: rechargeForm.paymentMethod,
          notes: rechargeForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al recargar saldo');

      addNotification(data.message || 'Saldo recargado correctamente', 'success');
      setShowRechargeModal(false);
      setSelectedCardForRecharge(null);
      fetchGiftCards();
    } catch (err: any) {
      addNotification(err.message || 'Error al recargar saldo', 'error');
    }
  };

  const handleToggleCardBlock = async (card: GiftCardDTO) => {
    const nextStatus = card.status === 'BLOCKED' ? (card.balance > 0 ? 'ACTIVE' : 'DEPLETED') : 'BLOCKED';
    try {
      const res = await fetch(`/api/gift-cards/${encodeURIComponent(card.code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al cambiar estado');
      }

      addNotification(
        nextStatus === 'BLOCKED' ? `Tarjeta ${card.code} bloqueada` : `Tarjeta ${card.code} reactivada`,
        'info'
      );
      fetchGiftCards();
    } catch (err: any) {
      addNotification(err.message || 'Error al actualizar tarjeta', 'error');
    }
  };

  return (
    <DashboardContainer>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              {activeMainTab === 'crm' ? (
                <>
                  <Users className="h-8 w-8 text-amber-400" />
                  Clientes & Fidelización CRM
                </>
              ) : (
                <>
                  <CreditCard className="h-8 w-8 text-amber-400" />
                  Monedero Electrónico & Gift Cards
                </>
              )}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {activeMainTab === 'crm'
                ? 'Gestiona tu base de clientes, historial de pedidos, preferencias y programa de puntos de lealtad.'
                : 'Emisión de tarjetas de regalo, monederos de saldo prepago para clientes VIP, recargas y auditoría de saldo.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeMainTab === 'crm' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTierBenefitsModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm hover:border-amber-500/40"
                  title="Ver reglas, multiplicadores y descuentos de los niveles VIP"
                >
                  <Award className="h-4 w-4 text-amber-400" />
                  Niveles VIP & Beneficios
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="h-5 w-5 stroke-[2.5]" />
                  Nuevo Cliente
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowRechargeModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  <Coins className="h-4 w-4 text-emerald-400" />
                  Recarga Rápida
                </button>
                <button
                  onClick={() => {
                    setIssueForm((prev) => ({ ...prev, code: generateGiftCardCode() }));
                    setShowIssueModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="h-5 w-5 stroke-[2.5]" />
                  Emitir Tarjeta / Monedero
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveMainTab('crm')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeMainTab === 'crm'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Clientes & Puntos de Lealtad
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {stats.totalCustomers}
            </span>
          </button>
          <button
            onClick={() => setActiveMainTab('giftcards')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeMainTab === 'giftcards'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Monedero Electrónico & Gift Cards
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
              {giftCardsSummary.totalCards}
            </span>
          </button>
        </div>

        {activeMainTab === 'crm' && (
          <>
            {/* VIP Tier & CRM Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Clientes</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.totalCustomers}</h3>
                    <span className="text-[10px] text-slate-500 mt-0.5 inline-block">Base CRM</span>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              </div>

              {/* Bronce */}
              <div 
                onClick={() => setFilterType('BRONZE')}
                className={`bg-slate-900/90 border rounded-2xl p-4 relative overflow-hidden cursor-pointer transition-all ${
                  filterType === 'BRONZE' ? 'border-amber-700 bg-amber-950/20 shadow-md shadow-amber-950/30' : 'border-slate-800 hover:border-amber-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      🥉 Bronce
                    </p>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.bronzeCount ?? 0}</h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 inline-block">1.0x pts</span>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-amber-800/10 border border-amber-800/30 flex items-center justify-center text-base">
                    🥉
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-700" />
              </div>

              {/* Plata */}
              <div 
                onClick={() => setFilterType('SILVER')}
                className={`bg-slate-900/90 border rounded-2xl p-4 relative overflow-hidden cursor-pointer transition-all ${
                  filterType === 'SILVER' ? 'border-slate-300 bg-slate-800/40 shadow-md shadow-slate-700/30' : 'border-slate-800 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      🥈 Plata
                    </p>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.silverCount ?? 0}</h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 inline-block">1.25x • 5% off</span>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-slate-300/10 border border-slate-300/30 flex items-center justify-center text-base">
                    🥈
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-300" />
              </div>

              {/* Oro */}
              <div 
                onClick={() => setFilterType('GOLD')}
                className={`bg-slate-900/90 border rounded-2xl p-4 relative overflow-hidden cursor-pointer transition-all ${
                  filterType === 'GOLD' ? 'border-amber-400 bg-amber-950/30 shadow-md shadow-amber-500/20' : 'border-slate-800 hover:border-amber-400/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      🥇 Oro
                    </p>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">{stats.goldCount ?? 0}</h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 inline-block">1.5x • 10% off</span>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-base">
                    🥇
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-400" />
              </div>

              {/* Platino */}
              <div 
                onClick={() => setFilterType('PLATINUM')}
                className={`bg-slate-900/90 border rounded-2xl p-4 relative overflow-hidden cursor-pointer transition-all ${
                  filterType === 'PLATINUM' ? 'border-cyan-400 bg-cyan-950/30 shadow-md shadow-cyan-500/20' : 'border-slate-800 hover:border-cyan-400/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                      💎 Platino VIP
                    </p>
                    <h3 className="text-xl sm:text-2xl font-black text-cyan-300 mt-0.5">{stats.platinumCount ?? 0}</h3>
                    <span className="text-[10px] text-cyan-400/80 mt-0.5 inline-block">2.0x • 15% off</span>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-base shadow-sm shadow-cyan-500/20">
                    💎
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-cyan-400" />
              </div>

              {/* Cumpleaños del Mes */}
              <div 
                onClick={() => setFilterType('birthdays')}
                className={`bg-slate-900/90 border rounded-2xl p-4 relative overflow-hidden cursor-pointer transition-all ${
                  filterType === 'birthdays' ? 'border-pink-500 bg-pink-950/30 shadow-md shadow-pink-500/20' : 'border-slate-800 hover:border-pink-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1">
                      🎂 Cumpleaños
                    </p>
                    <h3 className="text-xl sm:text-2xl font-black text-pink-300 mt-0.5">{stats.birthdayCount ?? 0}</h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 inline-block">En este mes</span>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                    <Cake className="h-4 w-4" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
              </div>
            </div>

            {/* Wallet & Cashback Stats Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" /> Saldo Total en Monederos
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-emerald-300 font-mono mt-0.5">
                    ${(stats.totalWalletBalance || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">MXN</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Fondos activos disponibles para canje</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Coins className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-teal-950/40 to-slate-900 border border-teal-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Cashback Total Acreditado
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-teal-300 font-mono mt-0.5">
                    ${(stats.totalCashbackEarned || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">MXN</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Acumulado histórico por compras</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Award className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> Cashback Redimido en Caja
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-0.5">
                    ${(stats.totalCashbackSpent || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">MXN</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Ahorro efectivo transferido a comensales</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
              <form onSubmit={handleSearch} className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </form>

              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Todos ({stats.totalCustomers})
                </button>
                <button
                  onClick={() => setFilterType('BRONZE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    filterType === 'BRONZE'
                      ? 'bg-amber-700 text-white shadow-md shadow-amber-700/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  🥉 Bronce ({stats.bronzeCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterType('SILVER')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    filterType === 'SILVER'
                      ? 'bg-slate-300 text-slate-950 shadow-md shadow-slate-300/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  🥈 Plata ({stats.silverCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterType('GOLD')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    filterType === 'GOLD'
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  🥇 Oro ({stats.goldCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterType('PLATINUM')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    filterType === 'PLATINUM'
                      ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  💎 Platino ({stats.platinumCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterType('birthdays')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    filterType === 'birthdays'
                      ? 'bg-pink-500 text-slate-950 shadow-md shadow-pink-500/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Cake className="h-3.5 w-3.5 text-pink-400" />
                  Cumpleaños ({stats.birthdayCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterType('recent')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    filterType === 'recent'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" /> Recientes
                </button>
                <button
                  onClick={() => fetchCustomers()}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-auto md:ml-0 cursor-pointer"
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  Registrar Primer Cliente
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {customers.map((customer) => {
                  const tier = customer.tierConfig || LOYALTY_TIERS[customer.tier as LoyaltyTierId] || LOYALTY_TIERS.BRONZE;
                  const isPlatinum = tier.id === 'PLATINUM';
                  const isGold = tier.id === 'GOLD';
                  const isSilver = tier.id === 'SILVER';
                  const isBirthdayMonth = customer.birthdayInfo?.isBirthdayThisMonth;

                  return (
                    <div
                      key={customer.id}
                      className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group relative ${
                        isPlatinum
                          ? 'border-cyan-500/40 hover:border-cyan-400 shadow-lg shadow-cyan-500/5'
                          : isGold
                          ? 'border-amber-400/40 hover:border-amber-300 shadow-md shadow-amber-400/5'
                          : isSilver
                          ? 'border-slate-700 hover:border-slate-500'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Bar inside Card */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm relative ${
                              isPlatinum
                                ? 'bg-cyan-950/60 text-cyan-300 ring-2 ring-cyan-400/50'
                                : isGold
                                ? 'bg-amber-950/60 text-amber-300 ring-2 ring-amber-400/50'
                                : isSilver
                                ? 'bg-slate-800 text-slate-200 ring-1 ring-slate-400/50'
                                : 'bg-amber-950/30 text-amber-500 ring-1 ring-amber-800/40'
                            }`}>
                              {customer.name.substring(0, 2).toUpperCase()}
                              <span className="absolute -bottom-1 -right-1 text-xs">
                                {tier.icon}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                                  {customer.name}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-slate-400" /> {customer.phone}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Tier Badge & Loyalty Points */}
                          <div className="flex flex-col items-end gap-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${tier.badgeClass}`}>
                              {tier.badge}
                            </span>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold">
                              <Sparkles className="h-3 w-3 text-purple-400" />
                              <span>{customer.loyaltyPoints} pts</span>
                            </div>
                          </div>
                        </div>

                        {/* VIP Multiplier & Perks Pill */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            <Zap className="h-3 w-3" /> {customer.pointsMultiplier || tier.pointsMultiplier}x Puntos
                          </span>
                          {(customer.tierDiscountPct > 0 || tier.discountPct > 0) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
                              <Award className="h-3 w-3" /> {customer.tierDiscountPct || tier.discountPct}% Desc. VIP
                            </span>
                          )}
                        </div>

                        {/* Birthday Alert if this month */}
                        {isBirthdayMonth && (
                          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-pink-950/40 border border-pink-500/30 text-pink-300 text-xs font-semibold mb-3">
                            <div className="flex items-center gap-1.5">
                              <Cake className="h-3.5 w-3.5 text-pink-400" />
                              <span>Cumpleaños: {customer.birthdayInfo?.formattedBirthDate || customer.birthDate}</span>
                            </div>
                            {customer.birthdayInfo?.isBirthdayThisWeek && (
                              <span className="px-2 py-0.5 bg-pink-500 text-slate-950 text-[10px] font-black rounded-full animate-pulse">
                                ¡Esta semana! 🎁
                              </span>
                            )}
                          </div>
                        )}

                        {/* Details section */}
                        <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 rounded-xl p-3 mb-3">
                          {customer.email && (
                            <div className="flex items-center gap-2 truncate">
                              <Mail className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          )}
                          {customer.birthDate && !isBirthdayMonth && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Cake className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span>Cumpleaños: {customer.birthdayInfo?.formattedBirthDate || customer.birthDate}</span>
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

                        {/* Tier Progress Bar */}
                        {customer.tierProgress?.nextTier ? (
                          <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/70 mb-3">
                            <div className="flex justify-between items-center text-[10px] mb-1.5">
                              <span className="text-slate-400 flex items-center gap-1 font-semibold">
                                <TrendingUp className="h-3 w-3 text-amber-400" />
                                Hacia {customer.tierProgress.nextTier.badge}
                              </span>
                              <span className="font-mono text-amber-400 font-bold">
                                {customer.tierProgress.overallProgressPct}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300"
                                style={{ width: `${customer.tierProgress.overallProgressPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                              <span>Faltan ${customer.tierProgress.spentRemaining.toFixed(0)}</span>
                              <span>o {customer.tierProgress.ordersRemaining} pedidos</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-cyan-950/30 rounded-xl p-2.5 border border-cyan-500/20 mb-3 flex items-center justify-between text-[11px] text-cyan-300 font-bold">
                            <span className="flex items-center gap-1.5">
                              💎 Nivel Máximo VIP Platino
                            </span>
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono">
                              2.0x • 15% Desc
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Stats & Actions */}
                      <div>
                        {/* Monedero & Cashback Badge */}
                        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-2.5 mb-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                              <Wallet className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">Saldo Monedero</p>
                              <p className="text-sm font-black text-emerald-400 font-mono">
                                ${(customer.walletBalance || 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">MXN</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/20 block">
                              {customer.cashbackRatePct || 5}% Cashback
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                              Ganado: ${(customer.totalCashbackEarned || 0).toFixed(0)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center py-2 px-3 bg-slate-950 rounded-xl border border-slate-800/80 mb-3">
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

                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => {
                              setSelectedCustomerForWallet(customer);
                              fetchCustomerWallet(customer.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Ver monedero digital, código QR y estado de cuenta"
                          >
                            <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                            Monedero & QR
                          </button>

                          <button
                            onClick={() => setSelectedCustomerForHistory(customer)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                            title="Historial de Pedidos y Puntos"
                          >
                            <Clock className="h-4 w-4 text-amber-400" />
                          </button>

                          <button
                            onClick={() => setEditingCustomer(customer)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Editar cliente"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                            className="p-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
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
      </>
    )}

    {/* ========================================================================= */}
    {/* TAB 2: MONEDERO ELECTRÓNICO & GIFT CARDS                                  */}
    {/* ========================================================================= */}
    {activeMainTab === 'giftcards' && (
      <>
        {/* Gift Cards KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tarjetas Emitidas</p>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{giftCardsSummary.totalCards}</h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">Físicas, Digitales & VIP</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <CreditCard className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5" /> Saldo Circulante
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                  ${giftCardsSummary.totalCirculatingBalance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">Prepago disponible en caja</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Tarjetas Activas</p>
                <h3 className="text-2xl sm:text-3xl font-black text-blue-400 mt-1">{giftCardsSummary.activeCards}</h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">Listas para compras en POS</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Auditoría Transaccional</p>
                <h3 className="text-2xl sm:text-3xl font-black text-purple-400 mt-1">100%</h3>
                <span className="text-xs text-slate-500 mt-1 inline-block">Trazabilidad en cada débito</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <History className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
          </div>
        </div>

        {/* Search, Filter & Actions Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por código (ej. GF-...), titular o notas..."
                value={giftCardSearch}
                onChange={(e) => setGiftCardSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'ACTIVE', 'DEPLETED', 'BLOCKED', 'EXPIRED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setGiftCardStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    giftCardStatusFilter === status
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status === 'ALL' && 'Todas'}
                  {status === 'ACTIVE' && 'Activas'}
                  {status === 'DEPLETED' && 'Sin Saldo'}
                  {status === 'BLOCKED' && 'Bloqueadas'}
                  {status === 'EXPIRED' && 'Vencidas'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchGiftCards()}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl border border-slate-700/50 transition-colors cursor-pointer"
              title="Actualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${giftCardLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Gift Cards Grid */}
        {giftCardLoading && giftCards.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Cargando monederos y tarjetas de regalo...
          </div>
        ) : giftCards.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4">
              <CreditCard className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No hay tarjetas de regalo registradas</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Emite tarjetas de regalo digitales o físicas y asigna monederos electrónicos prepago a tus clientes frecuentes.
            </p>
            <button
              onClick={() => {
                setIssueForm((prev) => ({ ...prev, code: generateGiftCardCode() }));
                setShowIssueModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              Emitir Primera Tarjeta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {giftCards.map((card) => {
              const isBlocked = card.status === 'BLOCKED';
              const isExpired = card.status === 'EXPIRED';
              const isDepleted = card.status === 'DEPLETED';

              return (
                <div
                  key={card.id}
                  className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Card Background Accent Decor */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />

                  {/* Header: Card Chip & Status */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-10 bg-gradient-to-tr from-amber-600 to-amber-300 rounded-md border border-amber-300/40 flex items-center justify-center shadow-inner">
                          <div className="w-3 h-3 rounded-full border border-amber-950/40" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {card.cardType === 'VIP_PREPAID' ? 'MONEDERO VIP' : card.cardType === 'FISICA' ? 'GIFT CARD FÍSICA' : 'GIFT CARD DIGITAL'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            card.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : isBlocked
                              ? 'bg-red-950 text-red-400 border border-red-800/40'
                              : isExpired
                              ? 'bg-orange-950 text-orange-400 border border-orange-800/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isBlocked && <Lock className="h-3 w-3" />}
                          {card.status}
                        </span>
                      </div>
                    </div>

                    {/* Card Code Display */}
                    <div className="mb-4">
                      <div className="text-xl sm:text-2xl font-mono font-black text-amber-200 tracking-wider">
                        {card.code}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          Titular:{' '}
                          <strong className="text-slate-200">
                            {card.customer?.name || 'Al Portador'}
                          </strong>
                        </span>
                        {card.pin && (
                          <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                            PIN: ••••
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 mb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Disponible</span>
                        <span className="text-2xl font-black text-emerald-400">
                          ${card.balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Monto Inicial</span>
                        <span className="text-xs text-slate-400 font-mono">
                          ${card.initialBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Notes & Expiration */}
                    {(card.notes || card.expiresAt) && (
                      <div className="text-xs text-slate-500 mb-3 space-y-0.5">
                        {card.expiresAt && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Vence: {new Date(card.expiresAt).toLocaleDateString('es-MX')}
                          </div>
                        )}
                        {card.notes && (
                          <p className="line-clamp-1 italic text-slate-400">"{card.notes}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setRechargeForm({
                            code: card.code,
                            amount: 200,
                            paymentMethod: 'EFECTIVO',
                            notes: '',
                          });
                          setSelectedCardForRecharge(card);
                          setShowRechargeModal(true);
                        }}
                        disabled={isBlocked || isExpired}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Recargar saldo a este monedero"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Recargar
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/gift-cards/${encodeURIComponent(card.code)}`);
                            if (res.ok) {
                              const data = await res.json();
                              setSelectedCardForHistory(data.card);
                            } else {
                              setSelectedCardForHistory(card);
                            }
                          } catch {
                            setSelectedCardForHistory(card);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Ver auditoría y movimientos"
                      >
                        <History className="h-3.5 w-3.5 text-blue-400" />
                        Movimientos
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleCardBlock(card)}
                      className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                        isBlocked
                          ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                          : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-750'
                      }`}
                      title={isBlocked ? 'Desbloquear tarjeta' : 'Bloquear tarjeta (seguridad)'}
                    >
                      {isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Issue Gift Card / VIP Prepaid */}
        {showIssueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Emitir Monedero / Gift Card</h3>
                    <p className="text-xs text-slate-400">Tarjeta prepago para consumo en restaurante</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleIssueCardSubmit} className="p-6 space-y-4">
                {/* Code & Randomizer */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Código de la Tarjeta *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={issueForm.code}
                      onChange={(e) => setIssueForm({ ...issueForm, code: e.target.value.toUpperCase() })}
                      placeholder="GF-XXXX-XXXX"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-amber-200 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIssueForm({ ...issueForm, code: generateGiftCardCode() })}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Generar código aleatorio seguro"
                    >
                      Generar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Initial Balance */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Saldo Inicial ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={issueForm.initialBalance}
                      onChange={(e) => setIssueForm({ ...issueForm, initialBalance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>

                  {/* Card Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tipo de Tarjeta
                    </label>
                    <select
                      value={issueForm.cardType}
                      onChange={(e) => setIssueForm({ ...issueForm, cardType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="DIGITAL">Digital (Email / WhatsApp)</option>
                      <option value="FISICA">Tarjeta Plástica PVC</option>
                      <option value="VIP_PREPAID">Monedero Cliente VIP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Link */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Cliente Asignado
                    </label>
                    <select
                      value={issueForm.customerId}
                      onChange={(e) => setIssueForm({ ...issueForm, customerId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Al Portador (Sin cliente fijo)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || c.email || 'Sin contacto'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* PIN */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      PIN de Seguridad (Opcional)
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={issueForm.pin}
                      onChange={(e) => setIssueForm({ ...issueForm, pin: e.target.value })}
                      placeholder="Ej. 1234"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Fecha de Vencimiento (Opcional)
                  </label>
                  <input
                    type="date"
                    value={issueForm.expiresAt}
                    onChange={(e) => setIssueForm({ ...issueForm, expiresAt: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Notas / Motivo de Emisión
                  </label>
                  <input
                    type="text"
                    value={issueForm.notes}
                    onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                    placeholder="Ej. Regalo corporativo de Fin de Año"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    Emitir Tarjeta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Recharge Card */}
        {showRechargeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Recargar Saldo</h3>
                    <p className="text-xs text-slate-400">Abonar saldo a tarjeta prepago existente</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRechargeModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleRechargeCardSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Código de la Tarjeta *
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeForm.code}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, code: e.target.value.toUpperCase() })}
                    placeholder="GF-XXXX-XXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-amber-200 focus:outline-none focus:border-amber-500"
                  />
                  {selectedCardForRecharge && (
                    <span className="text-xs text-slate-400 mt-1 block">
                      Saldo actual: <strong className="text-emerald-400">${selectedCardForRecharge.balance.toFixed(2)}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Monto a Recargar ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={rechargeForm.amount}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-lg font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Método de Pago Recibido en Caja
                  </label>
                  <select
                    value={rechargeForm.paymentMethod}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TARJETA">Tarjeta de Crédito / Débito</option>
                    <option value="TRANSFERENCIA">Transferencia SPEI / Banco</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Notas de la Recarga
                  </label>
                  <input
                    type="text"
                    value={rechargeForm.notes}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, notes: e.target.value })}
                    placeholder="Ej. Recarga en caja principal POS-1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRechargeModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    Confirmar Recarga
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Card Transactions History */}
        {selectedCardForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Estado de Cuenta: <span className="font-mono text-amber-300">{selectedCardForHistory.code}</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Saldo Actual: <strong className="text-emerald-400 font-mono">${selectedCardForHistory.balance.toFixed(2)}</strong> | Titular: {selectedCardForHistory.customer?.name || 'Al Portador'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCardForHistory(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-3 flex-1">
                {!selectedCardForHistory.transactions || selectedCardForHistory.transactions.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No hay transacciones registradas para este monedero.
                  </div>
                ) : (
                  selectedCardForHistory.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            tx.type === 'EMISSION'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.type === 'RECHARGE'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : tx.type === 'REDEMPTION'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {tx.type === 'REDEMPTION' ? (
                            <ArrowDownRight className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-slate-200">
                              {tx.type === 'EMISSION' && 'Emisión Inicial'}
                              {tx.type === 'RECHARGE' && 'Recarga de Saldo'}
                              {tx.type === 'REDEMPTION' && 'Consumo / Pago de Orden'}
                              {tx.type === 'ADJUSTMENT' && 'Ajuste Manual'}
                            </span>
                            {tx.orderId && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                                Orden #{tx.orderId.slice(-6)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {tx.notes || 'Transacción registrada'}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(tx.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-black font-mono block ${
                            tx.type === 'REDEMPTION' ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {tx.type === 'REDEMPTION' ? '-' : '+'}${tx.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Saldo: ${tx.balanceAfter.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Cake className="h-3.5 w-3.5 text-pink-400" /> Fecha de Nacimiento
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Award className="h-3.5 w-3.5 text-amber-400" /> Nivel de Lealtad
                    </label>
                    <select
                      value={formData.tier}
                      onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="BRONZE">Bronce 🥉 (Base 1.0x)</option>
                      <option value="SILVER">Plata 🥈 (1.25x pts, 5% desc)</option>
                      <option value="GOLD">Oro 🥇 (1.5x pts, 10% desc)</option>
                      <option value="PLATINUM">Platino VIP 💎 (2.0x pts, 15% desc)</option>
                    </select>
                  </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Cake className="h-3.5 w-3.5 text-pink-400" /> Fecha de Nacimiento
                    </label>
                    <input
                      type="date"
                      value={editingCustomer.birthDate || ''}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, birthDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Award className="h-3.5 w-3.5 text-amber-400" /> Nivel de Lealtad VIP
                    </label>
                    <select
                      value={editingCustomer.tier || 'BRONZE'}
                      onChange={(e) => {
                        const newT = e.target.value as LoyaltyTierId;
                        const cfg = LOYALTY_TIERS[newT] || LOYALTY_TIERS.BRONZE;
                        setEditingCustomer({
                          ...editingCustomer,
                          tier: newT,
                          pointsMultiplier: cfg.pointsMultiplier,
                          tierDiscountPct: cfg.discountPct,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="BRONZE">Bronce 🥉 (Base 1.0x)</option>
                      <option value="SILVER">Plata 🥈 (1.25x pts, 5% desc)</option>
                      <option value="GOLD">Oro 🥇 (1.5x pts, 10% desc)</option>
                      <option value="PLATINUM">Platino VIP 💎 (2.0x pts, 15% desc)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Multiplicador de Puntos (x)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      max="5"
                      value={editingCustomer.pointsMultiplier ?? 1.0}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, pointsMultiplier: parseFloat(e.target.value) || 1.0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Descuento VIP Automático (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={editingCustomer.tierDiscountPct ?? 0.0}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, tierDiscountPct: parseFloat(e.target.value) || 0.0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
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
                      {selectedCustomerForHistory.tierConfig && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${selectedCustomerForHistory.tierConfig.badgeClass}`}>
                          {selectedCustomerForHistory.tierConfig.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Tel: {selectedCustomerForHistory.phone}</span>
                      <span>•</span>
                      <span>Total Gastado: ${selectedCustomerForHistory.totalSpent.toFixed(2)}</span>
                      <span>•</span>
                      <span>{selectedCustomerForHistory.totalOrders} pedidos</span>
                    </p>
                    {selectedCustomerForHistory.birthdayInfo?.isBirthdayThisMonth && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-pink-400 font-semibold">
                        <Cake className="h-3.5 w-3.5" />
                        <span>¡Cumpleaños: {selectedCustomerForHistory.birthdayInfo.formattedBirthDate}! Recompensa recomendada activa.</span>
                      </div>
                    )}
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
        {/* Modal: VIP Tiers & Benefits Reference */}
        {showTierBenefitsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/40">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">Programa de Lealtad & Niveles VIP</h3>
                    <p className="text-xs text-slate-400">
                      Reglas de calificación automática, multiplicadores de puntos y beneficios exclusivos Soft Restaurant
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTierBenefitsModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TIER_ORDER.map((tierId) => {
                    const tier = LOYALTY_TIERS[tierId];
                    return (
                      <div
                        key={tierId}
                        className={`rounded-2xl border p-5 flex flex-col justify-between bg-slate-950/70 transition-all ${
                          tierId === 'PLATINUM'
                            ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                            : tierId === 'GOLD'
                            ? 'border-amber-400/40 shadow-md shadow-amber-400/10'
                            : tierId === 'SILVER'
                            ? 'border-slate-700'
                            : 'border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-3xl">{tier.icon}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${tier.badgeClass}`}>
                              {tier.name}
                            </span>
                          </div>

                          <div className="space-y-1 mb-4 pb-3 border-b border-slate-800">
                            <div className="text-xs text-slate-400">Requisito mínimo:</div>
                            <div className="text-sm font-bold text-white">
                              {tier.minSpent > 0 ? `$${tier.minSpent.toLocaleString('es-MX')} MXN` : 'Sin consumo mínimo'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {tier.minOrders > 0 ? `o ${tier.minOrders} pedidos acumulados` : 'Nivel de bienvenida'}
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-xs bg-slate-900 rounded-lg p-2 border border-slate-800">
                              <span className="text-slate-400">Multiplicador:</span>
                              <span className="font-black text-emerald-400">{tier.pointsMultiplier}x Pts</span>
                            </div>
                            <div className="flex items-center justify-between text-xs bg-slate-900 rounded-lg p-2 border border-slate-800">
                              <span className="text-slate-400">Descuento Auto:</span>
                              <span className="font-black text-amber-400">{tier.discountPct}% OFF</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Beneficios:
                            </div>
                            <ul className="space-y-1">
                              {tier.perks.map((perk, idx) => (
                                <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                  <span className="text-amber-400 text-xs mt-0.5">•</span>
                                  <span>{perk}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-slate-800 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <Cake className="h-4 w-4 text-pink-400" />
                    Club de Cumpleaños & Reglas de Fidelización Automatizada
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Al registrar la fecha de nacimiento de tus clientes, el sistema identifica automáticamente a los cumpleañeros de la semana y del mes. Además, cuando un cliente alcanza el umbral de consumo o número de pedidos mediante caja o pedidos online, el sistema promueve automáticamente su estatus al siguiente nivel VIP, aumentando su tasa de acumulación de puntos y su descuento automático sin intervención manual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Customer Digital Wallet & VIP Card Pass */}
        {selectedCustomerForWallet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-6 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">{selectedCustomerForWallet.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                        selectedCustomerForWallet.tier === 'PLATINUM' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50' :
                        selectedCustomerForWallet.tier === 'GOLD' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50' :
                        selectedCustomerForWallet.tier === 'SILVER' ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40' :
                        'bg-amber-800/20 text-amber-500 border border-amber-700/40'
                      }`}>
                        {selectedCustomerForWallet.tier} VIP
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Tel: {selectedCustomerForWallet.phone}</span>
                      <span>•</span>
                      <span>Cliente desde {new Date(selectedCustomerForWallet.createdAt).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomerForWallet(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Visual Digital VIP Card */}
                <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
                  selectedCustomerForWallet.tier === 'PLATINUM'
                    ? 'bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 border-cyan-400/50 shadow-cyan-500/10'
                    : selectedCustomerForWallet.tier === 'GOLD'
                    ? 'bg-gradient-to-br from-slate-950 via-amber-950 to-slate-900 border-amber-400/50 shadow-amber-500/10'
                    : selectedCustomerForWallet.tier === 'SILVER'
                    ? 'bg-gradient-to-br from-slate-950 via-slate-850 to-slate-900 border-slate-500/50'
                    : 'bg-gradient-to-br from-slate-950 via-amber-950/60 to-slate-900 border-amber-800/50'
                }`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block">
                        TARJETA DIGITAL DE CLIENTE VIP
                      </span>
                      <h4 className="text-lg font-black text-white tracking-wide mt-0.5">
                        {activeBrand?.name || 'DarkFlow Pass'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5 text-amber-400" />
                        <span>Membresía {selectedCustomerForWallet.tier}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-6">
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Saldo Disponible en Monedero</span>
                      <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight mt-1">
                        ${(selectedCustomerForWallet.walletBalance || 0).toFixed(2)} <span className="text-sm font-bold text-slate-300">MXN</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                          {selectedCustomerForWallet.cashbackRatePct || 5}% Cashback Automático
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                          {selectedCustomerForWallet.loyaltyPoints} Pts
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">CÓDIGO DE ESCANEO / QR</span>
                        <span className="font-mono text-xs font-bold text-white block">
                          {selectedCustomerForWallet.walletQrCode || 'DF-WAL-PENDING'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedCustomerForWallet.walletQrCode) {
                              navigator.clipboard.writeText(selectedCustomerForWallet.walletQrCode);
                              setCopiedQrCode(true);
                              setTimeout(() => setCopiedQrCode(false), 2000);
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
                        >
                          {copiedQrCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedQrCode ? '¡Copiado!' : 'Copiar código QR'}</span>
                        </button>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0">
                        <QrCode className="h-10 w-10 text-slate-950" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                    <div>
                      <span className="text-slate-400">Total Cashback Acumulado:</span>{' '}
                      <strong className="text-white">${(selectedCustomerForWallet.totalCashbackEarned || 0).toFixed(2)} MXN</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Canjeado:</span>{' '}
                      <strong className="text-amber-400">${(selectedCustomerForWallet.totalCashbackSpent || 0).toFixed(2)} MXN</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Consumo Histórico:</span>{' '}
                      <strong className="text-emerald-400">${selectedCustomerForWallet.totalSpent.toFixed(2)} MXN</strong>
                    </div>
                  </div>
                </div>

                {/* Form to Recharge / Adjust Balance */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Coins className="h-4 w-4 text-emerald-400" />
                      Abonar Saldo / Bono Promocional
                    </h4>
                    <span className="text-xs text-slate-400">Ajuste con folio de auditoría</span>
                  </div>

                  <form onSubmit={handleRechargeWallet} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Monto ($ MXN) *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="ej. 200 o -50"
                          value={walletRechargeForm.amount}
                          onChange={(e) => setWalletRechargeForm({ ...walletRechargeForm, amount: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:border-emerald-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Tipo de Movimiento *</label>
                        <select
                          value={walletRechargeForm.type}
                          onChange={(e) => setWalletRechargeForm({ ...walletRechargeForm, type: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                        >
                          <option value="MANUAL_RECHARGE">Recarga Manual de Saldo</option>
                          <option value="PROMO_BONUS">Bono Promocional / Cortesía</option>
                          <option value="REFUND_ADJUSTMENT">Ajuste o Compensación</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Folio / Referencia</label>
                        <input
                          type="text"
                          placeholder="ej. Recarga en Caja #1"
                          value={walletRechargeForm.reference}
                          onChange={(e) => setWalletRechargeForm({ ...walletRechargeForm, reference: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Notas / Justificación</label>
                      <input
                        type="text"
                        placeholder="Razón de la recarga o compensación..."
                        value={walletRechargeForm.notes}
                        onChange={(e) => setWalletRechargeForm({ ...walletRechargeForm, notes: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={walletSubmitting}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                      >
                        {walletSubmitting ? 'Procesando...' : 'Aplicar Saldo a Monedero'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Wallet Transactions History Table */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <History className="h-4 w-4 text-amber-400" />
                        Historial de Movimientos ({walletTransactions.length})
                      </h4>
                      <button
                        onClick={() => fetchCustomerWallet(selectedCustomerForWallet.id)}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Actualizar movimientos"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setWalletFilterType('ALL')}
                          className={`px-2 py-1 rounded transition ${walletFilterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setWalletFilterType('EARNED_CASHBACK')}
                          className={`px-2 py-1 rounded transition ${walletFilterType === 'EARNED_CASHBACK' ? 'bg-emerald-900/60 text-emerald-300' : 'text-slate-400'}`}
                        >
                          Cashback
                        </button>
                        <button
                          type="button"
                          onClick={() => setWalletFilterType('REDEEMED_PAYMENT')}
                          className={`px-2 py-1 rounded transition ${walletFilterType === 'REDEEMED_PAYMENT' ? 'bg-amber-900/60 text-amber-300' : 'text-slate-400'}`}
                        >
                          Canjes
                        </button>
                      </div>

                      <a
                        href={`/api/customers/${selectedCustomerForWallet.id}/wallet/export`}
                        download
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        <Download className="h-3.5 w-3.5 text-amber-400" />
                        <span>Exportar CSV</span>
                      </a>
                    </div>
                  </div>

                  {walletTransactions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
                      No hay transacciones registradas para este monedero aún.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {walletTransactions
                        .filter(t => walletFilterType === 'ALL' || t.type === walletFilterType)
                        .map((tx) => {
                          const isCredit = tx.type === 'EARNED_CASHBACK' || tx.type === 'MANUAL_RECHARGE' || tx.type === 'PROMO_BONUS';
                          return (
                            <div
                              key={tx.id}
                              className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isCredit ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {isCredit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">
                                      {tx.type === 'EARNED_CASHBACK' ? 'Cashback por Consumo' :
                                       tx.type === 'REDEEMED_PAYMENT' ? 'Canje en Comanda' :
                                       tx.type === 'MANUAL_RECHARGE' ? 'Recarga Manual' :
                                       tx.type === 'PROMO_BONUS' ? 'Bono Promocional' : 'Ajuste de Saldo'}
                                    </span>
                                    {tx.reference && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                                        {tx.reference}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>{new Date(tx.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    <span>•</span>
                                    <span>Por: {tx.createdByName || 'Sistema'}</span>
                                    {tx.notes && (
                                      <>
                                        <span>•</span>
                                        <span className="italic text-slate-400">{tx.notes}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className={`font-mono font-black text-sm ${isCredit ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                                </span>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  Saldo: ${tx.balanceAfter.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
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
