'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import { useAppStore } from '@/lib/store';
import { 
  Radio, 
  Send, 
  Copy, 
  Check, 
  DollarSign, 
  CheckCircle2, 
  FileCode, 
  User, 
  MapPin, 
  Phone, 
  Sparkles,
  RefreshCw,
  CreditCard,
  Lock,
  ShieldCheck,
  Key,
  ExternalLink,
  Zap
} from 'lucide-react';

interface PaymentConfigData {
  id: string;
  name: string;
  slug: string;
  paymentSandboxMode: boolean;
  allowOnlinePayments: boolean;
  hasStripeSecret: boolean;
  stripeSecretKeyMasked: string;
  stripePublicKey: string;
  hasMpToken: boolean;
  mpAccessTokenMasked: string;
  mpPublicKey: string;
  webhookUrl: string;
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
}

interface ExternalOrderSummary {
  id: string;
  orderNumber: string;
  externalOrderId?: string | null;
  source: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  status: string;
  subtotal: number;
  total: number;
  platformCommission?: number | null;
  platformCommissionRate?: number | null;
  netPayout?: number | null;
  deliveryService?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    product: {
      name: string;
    };
  }>;
}

interface DeliveryMetrics {
  totalOrders: number;
  totalGrossSales: number;
  totalCommissions: number;
  totalNetPayout: number;
  effectiveCommissionPercent: number;
  byPlatform: Record<string, { count: number; grossSales: number; commissions: number; netPayout: number }>;
}

export default function IntegrationsPage() {
  const { activeBrand, addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'PAYMENTS' | 'AUDIT' | 'CREDENTIALS'>('SIMULATOR');

  // Payments State
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigData | null>(null);
  const [, setLoadingPaymentConfig] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [paymentSandboxMode, setPaymentSandboxMode] = useState(true);
  const [allowOnlinePayments, setAllowOnlinePayments] = useState(true);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublicKey, setStripePublicKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpWebhookSecret, setMpWebhookSecret] = useState('');
  const [copiedPaymentWebhook, setCopiedPaymentWebhook] = useState(false);
  const [testingPaymentWebhook, setTestingPaymentWebhook] = useState(false);
  const [paymentWebhookTestResult, setPaymentWebhookTestResult] = useState<string | null>(null);

  // Products and Metrics
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [metrics, setMetrics] = useState<DeliveryMetrics | null>(null);
  const [orders, setOrders] = useState<ExternalOrderSummary[]>([]);

  // Simulator Form State
  const [selectedPlatform, setSelectedPlatform] = useState<'UBER_EATS' | 'RAPPI' | 'DIDI_FOOD'>('UBER_EATS');
  const [externalOrderId, setExternalOrderId] = useState('UBER-8941');
  const [customerName, setCustomerName] = useState('Carlos Mendoza');
  const [customerPhone, setCustomerPhone] = useState('5598765432');
  const [customerAddress, setCustomerAddress] = useState('Av. Insurgentes Sur 1420, Int. 4B, Col. Del Valle');
  const [notes, setNotes] = useState('Sin cubiertos, dejar en recepción');
  const [deliveryService, setDeliveryService] = useState<'PLATFORM_DRIVER' | 'INTERNAL_DRIVER'>('PLATFORM_DRIVER');
  const [customCommissionRate, setCustomCommissionRate] = useState<number>(28);
  const [selectedItems, setSelectedItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [sendingWebhook, setSendingWebhook] = useState(false);
  const [lastWebhookResult, setLastWebhookResult] = useState<string | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Platform styling helper
  const getPlatformMeta = (p: string) => {
    switch (p) {
      case 'UBER_EATS':
        return {
          name: 'Uber Eats',
          color: '#06C167',
          bgColor: 'bg-emerald-500/10',
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          hoverBorder: 'hover:border-emerald-500',
          defaultCommission: 28,
        };
      case 'RAPPI':
        return {
          name: 'Rappi',
          color: '#FF441F',
          bgColor: 'bg-orange-500/10',
          textColor: 'text-orange-400',
          borderColor: 'border-orange-500/30',
          hoverBorder: 'hover:border-orange-500',
          defaultCommission: 25,
        };
      case 'DIDI_FOOD':
        return {
          name: 'DiDi Food',
          color: '#FF5B00',
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-400',
          borderColor: 'border-amber-500/30',
          hoverBorder: 'hover:border-amber-500',
          defaultCommission: 22,
        };
      default:
        return {
          name: p,
          color: '#A855F7',
          bgColor: 'bg-purple-500/10',
          textColor: 'text-purple-400',
          borderColor: 'border-purple-500/30',
          hoverBorder: 'hover:border-purple-500',
          defaultCommission: 25,
        };
    }
  };

  // Generate random order ID
  const regenerateExternalId = (platform: string) => {
    const prefix = platform === 'UBER_EATS' ? 'UBER' : platform === 'RAPPI' ? 'RAPPI' : 'DIDI';
    const num = Math.floor(1000 + Math.random() * 9000);
    setExternalOrderId(`${prefix}-${num}`);
  };

  // Load products and metrics
  const loadData = useCallback(async () => {
    try {
      const [prodRes, metricsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/integrations/delivery'),
      ]);

      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.products || []);
        // Pre-select first product if empty
        if ((pData.products || []).length > 0 && selectedItems.length === 0) {
          setSelectedItems([{ productId: pData.products[0].id, quantity: 1 }]);
        }
      }

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData.metrics);
        setOrders(mData.orders || []);
      }
    } catch (err) {
      console.error('Error loading integrations data', err);
      addNotification('Error al cargar datos de integraciones', 'error');
    }
  }, [addNotification, selectedItems.length]);

  const loadPaymentConfig = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingPaymentConfig(true);
    try {
      const res = await fetch(`/api/integrations/payments?brandId=${activeBrand.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setPaymentConfig(data.config);
          setPaymentSandboxMode(Boolean(data.config.paymentSandboxMode));
          setAllowOnlinePayments(Boolean(data.config.allowOnlinePayments));
          setStripePublicKey(data.config.stripePublicKey || '');
          setMpPublicKey(data.config.mpPublicKey || '');
        }
      }
    } catch (err) {
      console.error('Error loading payment config', err);
    } finally {
      setLoadingPaymentConfig(false);
    }
  }, [activeBrand?.id]);

  useEffect(() => {
    loadData();
    loadPaymentConfig();
  }, [loadData, loadPaymentConfig, activeBrand?.id]);

  // When platform changes, update commission and prefix
  const handlePlatformChange = (p: 'UBER_EATS' | 'RAPPI' | 'DIDI_FOOD') => {
    setSelectedPlatform(p);
    const meta = getPlatformMeta(p);
    setCustomCommissionRate(meta.defaultCommission);
    regenerateExternalId(p);
  };

  // Item quantity controllers
  const handleAddItem = (productId: string) => {
    const existing = selectedItems.find(i => i.productId === productId);
    if (existing) {
      setSelectedItems(selectedItems.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems([...selectedItems, { productId, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (productId: string) => {
    const existing = selectedItems.find(i => i.productId === productId);
    if (existing && existing.quantity > 1) {
      setSelectedItems(selectedItems.map(i => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      setSelectedItems(selectedItems.filter(i => i.productId !== productId));
    }
  };

  // Live financial preview for simulator
  const simSubtotal = selectedItems.reduce((sum, item) => {
    const p = products.find(prod => prod.id === item.productId);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);
  const simTax = parseFloat((simSubtotal * 0.16).toFixed(2));
  const simTotal = parseFloat((simSubtotal + simTax).toFixed(2));
  const simCommission = parseFloat(((simTotal * customCommissionRate) / 100).toFixed(2));
  const simNetPayout = parseFloat((simTotal - simCommission).toFixed(2));

  // Trigger simulated webhook
  const handleSendSimulatedWebhook = async () => {
    if (selectedItems.length === 0) {
      addNotification('Selecciona al menos un producto para el pedido', 'warning');
      return;
    }

    setSendingWebhook(true);
    setLastWebhookResult(null);

    try {
      const payload = {
        platform: selectedPlatform,
        externalOrderId,
        brandId: activeBrand?.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        notes: notes.trim(),
        deliveryService,
        commissionRate: customCommissionRate,
        items: selectedItems.map(item => {
          const prod = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            price: prod?.price || 0,
          };
        }),
      };

      const res = await fetch('/api/webhooks/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(`¡Pedido ${data.order.externalOrderId} enviado a cocina vía ${selectedPlatform}!`, 'success');
        setLastWebhookResult(`Pedido creado: ${data.order.orderNumber} (${data.order.externalOrderId}) por $${data.financials.total} MXN (Comisión: $${data.financials.platformCommission} | Neto: $${data.financials.netPayout})`);
        regenerateExternalId(selectedPlatform);
        loadData();
      } else {
        addNotification(data.error || 'Error al procesar webhook', 'error');
      }
    } catch (err) {
      console.error('Failed to trigger webhook', err);
      addNotification('Error de conexión al simular pedido', 'error');
    } finally {
      setSendingWebhook(false);
    }
  };

  // Webhook URL string
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhooks/delivery` 
    : 'https://darkflow.app/api/webhooks/delivery';

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    addNotification('URL de webhook copiada al portapapeles', 'info');
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
  };

  // Payment Webhook URL string
  const paymentWebhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhooks/payments` 
    : 'https://darkflow.app/api/webhooks/payments';

  const handleCopyPaymentWebhook = () => {
    navigator.clipboard.writeText(paymentWebhookUrl);
    setCopiedPaymentWebhook(true);
    addNotification('URL de webhook de pagos copiada', 'info');
    setTimeout(() => setCopiedPaymentWebhook(false), 2000);
  };

  const handleSavePaymentConfig = async () => {
    if (!activeBrand?.id) return;
    setSavingPaymentConfig(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        brandId: activeBrand.id,
        paymentSandboxMode,
        allowOnlinePayments,
        stripePublicKey,
        mpPublicKey,
      };

      if (stripeSecretKey && !stripeSecretKey.includes('••••')) {
        payload.stripeSecretKey = stripeSecretKey;
      }
      if (stripeWebhookSecret && !stripeWebhookSecret.includes('••••')) {
        payload.stripeWebhookSecret = stripeWebhookSecret;
      }
      if (mpAccessToken && !mpAccessToken.includes('••••')) {
        payload.mpAccessToken = mpAccessToken;
      }
      if (mpWebhookSecret && !mpWebhookSecret.includes('••••')) {
        payload.mpWebhookSecret = mpWebhookSecret;
      }

      const res = await fetch('/api/integrations/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addNotification('Configuración de pasarelas de pago guardada con éxito', 'success');
        loadPaymentConfig();
      } else {
        addNotification(data.error || 'Error al guardar configuración', 'error');
      }
    } catch (err) {
      console.error('Error saving payment config', err);
      addNotification('Error de conexión al guardar configuración', 'error');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleTestPaymentWebhook = async (gateway: 'STRIPE' | 'MERCADOPAGO') => {
    setTestingPaymentWebhook(true);
    setPaymentWebhookTestResult(null);
    try {
      const dummyId = `test_${Date.now()}`;
      const payload = gateway === 'STRIPE'
        ? {
            id: `evt_${dummyId}`,
            type: 'checkout.session.completed',
            data: {
              object: {
                id: `cs_test_${dummyId}`,
                client_reference_id: orders[0]?.id || 'DEMO_ORDER_ID',
                payment_status: 'paid',
                amount_total: 25000,
                currency: 'mxn',
              },
            },
          }
        : {
            action: 'payment.created',
            type: 'payment',
            data: { id: `mp_${dummyId}` },
          };

      const res = await fetch('/api/webhooks/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setPaymentWebhookTestResult(`Webhook de ${gateway} respondido: ${JSON.stringify(data)}`);
        addNotification(`Webhook de prueba ${gateway} recibido y procesado`, 'info');
      } else {
        setPaymentWebhookTestResult(`Error webhook: ${data.error || 'Fallo de procesamiento'}`);
        addNotification('Fallo al simular webhook', 'warning');
      }
    } catch (err) {
      console.error('Error testing webhook', err);
      setPaymentWebhookTestResult('Error de red al invocar webhook');
    } finally {
      setTestingPaymentWebhook(false);
    }
  };

  return (
    <DashboardContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Radio className="w-6 h-6 animate-pulse" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Delivery Apps & Webhooks Hub
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Conexión unificada con Uber Eats, Rappi y DiDi Food. Simula pedidos, calcula comisiones y monitorea la cocina en vivo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              Webhook Activo (SSE)
            </span>
          </div>
        </div>

        {/* Global Financial Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ventas Brutas Apps</p>
            <p className="text-2xl font-black text-white font-mono">
              ${(metrics?.totalGrossSales || 0).toFixed(2)} <span className="text-xs text-slate-500">MXN</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{metrics?.totalOrders || 0} pedidos recibidos</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Comisiones Apps</p>
            <p className="text-2xl font-black text-red-400 font-mono">
              -${(metrics?.totalCommissions || 0).toFixed(2)} <span className="text-xs text-red-500/70">MXN</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Tasa promedio: {metrics?.effectiveCommissionPercent || 0}%</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pago Neto Liquidado</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">
              ${(metrics?.totalNetPayout || 0).toFixed(2)} <span className="text-xs text-emerald-500/70">MXN</span>
            </p>
            <p className="text-[11px] text-emerald-500/80 font-semibold mt-1">Ingreso real para la cocina</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Distribución Canales</p>
            <div className="flex gap-2 text-xs font-mono">
              <span className="text-emerald-400 font-bold">Uber: {metrics?.byPlatform?.UBER_EATS?.count || 0}</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-400 font-bold">Rappi: {metrics?.byPlatform?.RAPPI?.count || 0}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold">DiDi: {metrics?.byPlatform?.DIDI_FOOD?.count || 0}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
          <button
            onClick={() => setActiveTab('SIMULATOR')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'SIMULATOR'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Send className="w-4 h-4 text-orange-400" />
            Simulador de Pedidos en Vivo
          </button>
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'PAYMENTS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            Pasarelas de Pago (Stripe & MP)
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'AUDIT'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Auditoría de Comisiones & Órdenes ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('CREDENTIALS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'CREDENTIALS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4 text-blue-400" />
            Documentación & Webhook URL
          </button>
        </div>

        {/* TAB 1: SIMULATOR */}
        {activeTab === 'SIMULATOR' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Configuration Form */}
            <div className="lg:col-span-2 space-y-5">
              {/* Platform Selector Cards */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. Seleccionar Plataforma de Delivery:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['UBER_EATS', 'RAPPI', 'DIDI_FOOD'] as const).map((p) => {
                    const meta = getPlatformMeta(p);
                    const isSelected = selectedPlatform === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePlatformChange(p)}
                        className={`p-4 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-2 ${
                          isSelected
                            ? `${meta.bgColor} ${meta.borderColor} ring-2 ring-offset-2 ring-offset-slate-950 ring-${p === 'UBER_EATS' ? 'emerald' : p === 'RAPPI' ? 'orange' : 'amber'}-500 shadow-lg`
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span className="font-black text-sm">{meta.name}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.textColor}`}>
                          Comisión: {meta.defaultCommission}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order Info & Products */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    2. Configuración del Pedido Simulado:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">ID Externo:</span>
                    <span className="font-mono font-bold text-white text-xs bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                      {externalOrderId}
                    </span>
                    <button
                      onClick={() => regenerateExternalId(selectedPlatform)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Generar nuevo ID"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Nombre del Cliente</label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Teléfono</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Dirección de Entrega</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Notas / Instrucciones del Repartidor</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Servicio de Reparto</label>
                    <select
                      value={deliveryService}
                      onChange={(e) => setDeliveryService(e.target.value as 'PLATFORM_DRIVER' | 'INTERNAL_DRIVER')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                    >
                      <option value="PLATFORM_DRIVER">Repartidor de la App ({getPlatformMeta(selectedPlatform).name})</option>
                      <option value="INTERNAL_DRIVER">Repartidor Propio de la Dark Kitchen</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Tasa de Comisión (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={customCommissionRate}
                      onChange={(e) => setCustomCommissionRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Product Selector */}
                <div className="pt-2">
                  <label className="block text-[11px] text-slate-400 font-semibold mb-2">
                    Platillos Incluidos en la Orden:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                    {products.map((prod) => {
                      const item = selectedItems.find(i => i.productId === prod.id);
                      const qty = item ? item.quantity : 0;
                      return (
                        <div
                          key={prod.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                            qty > 0 ? 'bg-slate-900 border-brand-primary/50 text-white' : 'border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <p className="font-bold text-white truncate">{prod.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">${prod.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {qty > 0 ? (
                              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-1 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(prod.id)}
                                  className="text-slate-400 hover:text-white px-1"
                                >
                                  -
                                </button>
                                <span className="font-bold text-white">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddItem(prod.id)}
                                  className="text-slate-400 hover:text-white px-1"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddItem(prod.id)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded text-[11px]"
                              >
                                + Agregar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Ticket Simulation & Webhook Trigger */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-primary" />
                    <h3 className="font-bold text-white text-sm">Resumen de Liquidación</h3>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${getPlatformMeta(selectedPlatform).bgColor} ${getPlatformMeta(selectedPlatform).textColor}`}>
                    {getPlatformMeta(selectedPlatform).name}
                  </span>
                </div>

                {/* Simulated Ticket Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal Platillos:</span>
                    <span className="font-mono text-slate-200">${simSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>IVA (16%):</span>
                    <span className="font-mono text-slate-200">${simTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-slate-800">
                    <span>Total Pagado por Cliente:</span>
                    <span className="font-mono text-amber-400">${simTotal.toFixed(2)} MXN</span>
                  </div>
                </div>

                {/* Commission Breakdown Highlight */}
                <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-red-400">
                    <span>Comisión de Plataforma ({customCommissionRate}%):</span>
                    <span className="font-mono font-bold">-${simCommission.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold text-sm pt-1 border-t border-slate-800/60">
                    <span>Pago Neto a Recibir:</span>
                    <span className="font-mono">${simNetPayout.toFixed(2)} MXN</span>
                  </div>
                </div>

                {/* Trigger Button */}
                <button
                  type="button"
                  onClick={handleSendSimulatedWebhook}
                  disabled={sendingWebhook || selectedItems.length === 0}
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  {sendingWebhook ? 'Enviando Webhook...' : '🚀 Simular Envío de Pedido a Cocina'}
                </button>

                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  💡 <strong>Tip en vivo:</strong> Si mantienes abierta la pantalla de <span className="text-brand-primary">KDS Cocina (`/kitchen`)</span> en otra pestaña, sonará el timbre y la comanda entrará al instante.
                </p>

                {lastWebhookResult && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{lastWebhookResult}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIT & ORDERS */}
        {activeTab === 'AUDIT' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Historial de Comandas Externas</h3>
              <span className="text-xs text-slate-400">{orders.length} pedidos registrados</span>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No hay pedidos de plataformas externas aún. Usa el simulador para generar el primero.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Plataforma</th>
                      <th className="py-3 px-3">ID Externo / Ticket</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Platillos</th>
                      <th className="py-3 px-3 text-right">Venta Bruta</th>
                      <th className="py-3 px-3 text-right">Comisión Retenida</th>
                      <th className="py-3 px-3 text-right">Pago Neto</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map((order) => {
                      const meta = getPlatformMeta(order.source);
                      const commission = order.platformCommission ?? ((order.total * (order.platformCommissionRate || 25)) / 100);
                      const net = order.netPayout ?? (order.total - commission);

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bgColor} ${meta.textColor}`}>
                              {meta.name}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-white block">{order.externalOrderId || '-'}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{order.orderNumber}</span>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-200">{order.customerName}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{order.customerAddress}</p>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-slate-300">
                              {order.items.reduce((sum, it) => sum + it.quantity, 0)} productos
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                            ${order.total.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-red-400">
                            -${commission.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                            ${net.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PASARELAS DE PAGO (STRIPE & MERCADO PAGO) */}
        {activeTab === 'PAYMENTS' && (
          <div className="space-y-6">
            {/* Top Info Banner */}
            <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400 shrink-0">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">Pasarelas de Pago Digitales</h2>
                    {paymentSandboxMode ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Modo Sandbox Activo
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Modo Producción en Vivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Habilita pagos en línea con tarjeta y billeteras digitales para tus clientes en el Menú Digital Móvil (<span className="text-slate-300 font-mono">/m/[slug]</span>) y cobros dinámicos con código QR en la caja del POS (<span className="text-slate-300 font-mono">/pos</span>).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSavePaymentConfig}
                  disabled={savingPaymentConfig}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {savingPaymentConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingPaymentConfig ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>

            {/* Global Settings Card: Sandbox & Online Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Simulador / Modo Sandbox</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Permite realizar y aprobar transacciones de prueba con 1-clic sin requerir cobros bancarios reales.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentSandboxMode}
                    onChange={(e) => setPaymentSandboxMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Aceptar Pagos Digitales</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Habilita las opciones de Stripe y Mercado Pago en el checkout del menú público del cliente.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOnlinePayments}
                    onChange={(e) => setAllowOnlinePayments(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            {/* Gateway Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stripe Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#635BFF]/15 border border-[#635BFF]/30 flex items-center justify-center font-black text-[#635BFF] text-lg">
                      S
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Stripe</h3>
                      <p className="text-xs text-slate-400">Tarjetas de crédito/débito y Apple/Google Pay</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    paymentConfig?.hasStripeSecret
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {paymentConfig?.hasStripeSecret ? 'Configurado' : 'Sin Credenciales'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Secret Key (sk_live_... / sk_test_...)</span>
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </label>
                    <input
                      type="password"
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                      placeholder={paymentConfig?.stripeSecretKeyMasked || 'sk_test_...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Public Key (pk_live_... / pk_test_...)</span>
                      <Key className="w-3.5 h-3.5 text-slate-500" />
                    </label>
                    <input
                      type="text"
                      value={stripePublicKey}
                      onChange={(e) => setStripePublicKey(e.target.value)}
                      placeholder="pk_test_..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Webhook Signing Secret (whsec_...)</span>
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </label>
                    <input
                      type="password"
                      value={stripeWebhookSecret}
                      onChange={(e) => setStripeWebhookSecret(e.target.value)}
                      placeholder="whsec_..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    Obtener llaves en Stripe <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleTestPaymentWebhook('STRIPE')}
                    disabled={testingPaymentWebhook}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-indigo-400" />
                    Probar Webhook
                  </button>
                </div>
              </div>

              {/* Mercado Pago Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#009EE3]/15 border border-[#009EE3]/30 flex items-center justify-center font-black text-[#009EE3] text-lg">
                      MP
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Mercado Pago</h3>
                      <p className="text-xs text-slate-400">Tarjetas, transferencias SPEI y saldo MP</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    paymentConfig?.hasMpToken
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {paymentConfig?.hasMpToken ? 'Configurado' : 'Sin Credenciales'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Access Token (APP_USR-... o TEST-...)</span>
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </label>
                    <input
                      type="password"
                      value={mpAccessToken}
                      onChange={(e) => setMpAccessToken(e.target.value)}
                      placeholder={paymentConfig?.mpAccessTokenMasked || 'APP_USR-... o TEST-...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Public Key (APP_USR-...)</span>
                      <Key className="w-3.5 h-3.5 text-slate-500" />
                    </label>
                    <input
                      type="text"
                      value={mpPublicKey}
                      onChange={(e) => setMpPublicKey(e.target.value)}
                      placeholder="APP_USR-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Webhook Secret Signature (Opcional)</span>
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </label>
                    <input
                      type="password"
                      value={mpWebhookSecret}
                      onChange={(e) => setMpWebhookSecret(e.target.value)}
                      placeholder="Firma secreta del webhook..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <a
                    href="https://www.mercadopago.com.mx/developers/panel/app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                  >
                    Developers Mercado Pago <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleTestPaymentWebhook('MERCADOPAGO')}
                    disabled={testingPaymentWebhook}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-sky-400" />
                    Probar Webhook
                  </button>
                </div>
              </div>
            </div>

            {/* Webhook Endpoint Configuration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileCode className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-extrabold text-white text-base">URL Unificada de Webhooks de Pago</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">POST /api/webhooks/payments</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Registra esta URL tanto en el dashboard de Stripe (<span className="text-slate-300">Developers &gt; Webhooks</span>) como en Mercado Pago (<span className="text-slate-300">Notificaciones IPN / Webhooks</span>). DarkFlow conciliará los pagos y marcará las órdenes como PAGADAS en tiempo real con eventos Server-Sent Events (SSE).
              </p>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-indigo-400 truncate">{paymentWebhookUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyPaymentWebhook}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all"
                >
                  {copiedPaymentWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPaymentWebhook ? 'Copiado' : 'Copiar URL'}
                </button>
              </div>

              {paymentWebhookTestResult && (
                <div className="p-3 bg-slate-950 border border-indigo-500/30 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="truncate">{paymentWebhookTestResult}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CREDENTIALS & WEBHOOK URL */}
        {activeTab === 'CREDENTIALS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                Endpoint del Webhook Receptor
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Utiliza esta URL para configurar los webhooks entrantes en tu integrador oficial (Deliverect, Hubster, Ordatic) o enviar pedidos directamente desde sistemas externos.
              </p>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-emerald-400 truncate">{webhookUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  {copiedWebhookUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedWebhookUrl ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-300">Método HTTP: <span className="text-emerald-400 font-mono">POST</span></p>
                <p className="text-xs font-bold text-slate-300">Content-Type: <span className="text-blue-400 font-mono">application/json</span></p>
                <p className="text-xs font-bold text-slate-300">Autenticación: <span className="text-slate-400">Bearer Token o Header `x-delivery-secret`</span></p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white text-base">Estructura del Payload JSON</h3>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed">
                <pre>{`{
  "platform": "UBER_EATS", // UBER_EATS, RAPPI, DIDI_FOOD
  "externalOrderId": "UBER-8921",
  "customerName": "Carlos Mendoza",
  "customerPhone": "5512345678",
  "customerAddress": "Av. Insurgentes 123",
  "notes": "Dejar en caseta de vigilancia",
  "commissionRate": 28.0,
  "deliveryService": "PLATFORM_DRIVER",
  "items": [
    {
      "productId": "PROD_ID_AQUI",
      "quantity": 2,
      "price": 149.00
    }
  ]
}`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}
