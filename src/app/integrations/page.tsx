'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import FiscalConsole from '@/components/FiscalConsole';
import DeliveryReconciliationTab from '@/components/delivery/DeliveryReconciliationTab';
import { useAppStore } from '@/lib/store';
import { 
  Radio, 
  Send, 
  Copy, 
  Scale, 
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
  Zap,
  FileText,
  Building2,
  QrCode,
  Printer,
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  Sliders,
  Terminal,
  Play,
  Server
} from 'lucide-react';
import { TAX_REGIMES } from '@/lib/cfdi';

interface PrinterData {
  id: string;
  brandId: string;
  name: string;
  connectionType: string;
  ipAddress: string;
  port: number;
  paperWidth: string;
  targetStation: string;
  autoPrintTrigger: string;
  isActive: boolean;
  status: string;
  lastTestedAt: string | null;
  notes: string | null;
}

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
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'PAYMENTS' | 'AUDIT' | 'CREDENTIALS' | 'INVOICING' | 'PRINTERS'>('SIMULATOR');

  // Hardware Bridge / Printers State
  const [printers, setPrinters] = useState<PrinterData[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterData | null>(null);
  const [printerName, setPrinterName] = useState('');
  const [printerConnType, setPrinterConnType] = useState<'NETWORK' | 'VIRTUAL'>('NETWORK');
  const [printerIp, setPrinterIp] = useState('192.168.1.200');
  const [printerPort, setPrinterPort] = useState(9100);
  const [printerWidth, setPrinterWidth] = useState<'80mm' | '58mm'>('80mm');
  const [printerStation, setPrinterStation] = useState('ALL');
  const [printerTrigger, setPrinterTrigger] = useState('ON_ORDER_CREATED');
  const [printerNotes, setPrinterNotes] = useState('');
  const [printerIsActive, setPrinterIsActive] = useState(true);
  const [savingPrinter, setSavingPrinter] = useState(false);

  // Invoicing State (CFDI 4.0)
  const [invoicingRfc, setInvoicingRfc] = useState('');
  const [invoicingLegalName, setInvoicingLegalName] = useState('');
  const [invoicingTaxRegime, setInvoicingTaxRegime] = useState('601');
  const [invoicingPostalCode, setInvoicingPostalCode] = useState('');
  const [invoicingSeries, setInvoicingSeries] = useState('A');
  const [invoicingNextFolio, setInvoicingNextFolio] = useState(1);
  const [invoicingPacEnvironment, setInvoicingPacEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [invoicingCount, setInvoicingCount] = useState(0);
  const [savingInvoicingConfig, setSavingInvoicingConfig] = useState(false);
  const [copiedPortalUrl, setCopiedPortalUrl] = useState(false);

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

  const loadInvoicingConfig = useCallback(async () => {
    if (!activeBrand?.id) return;
    try {
      const res = await fetch(`/api/integrations/invoicing?brandId=${activeBrand.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setInvoicingRfc(data.config.rfc || '');
          setInvoicingLegalName(data.config.legalName || '');
          setInvoicingTaxRegime(data.config.taxRegime || '601');
          setInvoicingPostalCode(data.config.postalCode || '');
          setInvoicingSeries(data.config.invoiceSeries || 'A');
          setInvoicingNextFolio(data.config.invoiceNextFolio || 1);
          setInvoicingPacEnvironment(data.config.pacEnvironment || 'SANDBOX');
          setInvoicingCount(data.config.invoiceCount || 0);
        }
      }
    } catch (err) {
      console.error('Error loading invoicing config', err);
    }
  }, [activeBrand?.id]);

  useEffect(() => {
    loadData();
    loadPaymentConfig();
    loadInvoicingConfig();
  }, [loadData, loadPaymentConfig, loadInvoicingConfig, activeBrand?.id]);

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

  const invoicingPortalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/facturacion`
    : 'https://darkflow.app/facturacion';

  const handleCopyPortalUrl = () => {
    navigator.clipboard.writeText(invoicingPortalUrl);
    setCopiedPortalUrl(true);
    addNotification('URL del portal de autofacturación copiada al portapapeles', 'info');
    setTimeout(() => setCopiedPortalUrl(false), 2000);
  };

  const handleSaveInvoicingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) return;
    setSavingInvoicingConfig(true);
    try {
      const res = await fetch('/api/integrations/invoicing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrand.id,
          rfc: invoicingRfc,
          legalName: invoicingLegalName,
          taxRegime: invoicingTaxRegime,
          postalCode: invoicingPostalCode,
          invoiceSeries: invoicingSeries,
          invoiceNextFolio: Number(invoicingNextFolio),
          pacEnvironment: invoicingPacEnvironment,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification('Configuración fiscal CFDI 4.0 guardada correctamente', 'success');
        loadInvoicingConfig();
      } else {
        addNotification(data.error || 'Error al guardar configuración fiscal', 'error');
      }
    } catch (err) {
      console.error('Error saving invoicing config', err);
      addNotification('Error de conexión al guardar configuración fiscal', 'error');
    } finally {
      setSavingInvoicingConfig(false);
    }
  };

  const loadPrinters = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoadingPrinters(true);
    try {
      const res = await fetch('/api/printers', {
        headers: { 'x-brand-id': activeBrand.id },
      });
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.printers || []);
      }
    } catch (err) {
      console.error('Error fetching printers', err);
    } finally {
      setLoadingPrinters(false);
    }
  }, [activeBrand?.id]);

  useEffect(() => {
    if (activeBrand?.id) {
      loadPrinters();
    }
  }, [activeBrand?.id, loadPrinters]);

  const openCreatePrinterModal = () => {
    setEditingPrinter(null);
    setPrinterName('');
    setPrinterConnType('NETWORK');
    setPrinterIp('192.168.1.200');
    setPrinterPort(9100);
    setPrinterWidth('80mm');
    setPrinterStation('ALL');
    setPrinterTrigger('ON_ORDER_CREATED');
    setPrinterNotes('');
    setPrinterIsActive(true);
    setPrinterModalOpen(true);
  };

  const openEditPrinterModal = (p: PrinterData) => {
    setEditingPrinter(p);
    setPrinterName(p.name);
    setPrinterConnType((p.connectionType as 'NETWORK' | 'VIRTUAL') || 'NETWORK');
    setPrinterIp(p.ipAddress);
    setPrinterPort(p.port);
    setPrinterWidth((p.paperWidth as '80mm' | '58mm') || '80mm');
    setPrinterStation(p.targetStation);
    setPrinterTrigger(p.autoPrintTrigger);
    setPrinterNotes(p.notes || '');
    setPrinterIsActive(p.isActive);
    setPrinterModalOpen(true);
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrand?.id) return;
    if (!printerName.trim()) {
      addNotification('El nombre de la impresora es obligatorio', 'warning');
      return;
    }

    setSavingPrinter(true);
    try {
      const payload = {
        brandId: activeBrand.id,
        name: printerName.trim(),
        connectionType: printerConnType,
        ipAddress: printerIp.trim(),
        port: Number(printerPort) || 9100,
        paperWidth: printerWidth,
        targetStation: printerStation,
        autoPrintTrigger: printerTrigger,
        notes: printerNotes.trim(),
        isActive: printerIsActive,
      };

      const url = editingPrinter ? `/api/printers/${editingPrinter.id}` : '/api/printers';
      const method = editingPrinter ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-brand-id': activeBrand.id },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification(
          editingPrinter ? 'Impresora actualizada correctamente' : 'Impresora registrada exitosamente',
          'success'
        );
        setPrinterModalOpen(false);
        loadPrinters();
      } else {
        addNotification(data.error || 'Error al guardar impresora', 'error');
      }
    } catch (err) {
      console.error('Error saving printer', err);
      addNotification('Error de conexión al guardar impresora', 'error');
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta impresora?')) return;
    try {
      const res = await fetch(`/api/printers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addNotification('Impresora eliminada', 'info');
        loadPrinters();
      } else {
        addNotification('Error al eliminar impresora', 'error');
      }
    } catch (err) {
      console.error('Error deleting printer', err);
      addNotification('Error de conexión al eliminar impresora', 'error');
    }
  };

  const handleTestPrinter = async (id: string, action: 'PRINT_TEST' | 'KICK_DRAWER' = 'PRINT_TEST') => {
    setTestingPrinterId(id);
    try {
      const res = await fetch(`/api/printers/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification(
          action === 'KICK_DRAWER'
            ? `Cajón abierto: ${data.message}`
            : `Impresión exitosa: ${data.message} (${data.latencyMs || 0}ms)`,
          'success'
        );
        loadPrinters();
      } else {
        addNotification(data.error || 'Fallo de conexión con la impresora', 'error');
        loadPrinters();
      }
    } catch (err) {
      console.error('Error testing printer', err);
      addNotification('Error de red al comunicarse con el bridge de impresión', 'error');
    } finally {
      setTestingPrinterId(null);
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
            <Scale className="w-4 h-4 text-emerald-400" />
            Conciliación Delivery & Liquidaciones
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
          <button
            onClick={() => setActiveTab('INVOICING')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'INVOICING'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-400" />
            Facturación SAT CFDI 4.0 {invoicingCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">{invoicingCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('PRINTERS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'PRINTERS'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            Hardware Bridge & Impresoras {printers.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">{printers.length}</span>}
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

        {/* TAB: CONCILIACIÓN DELIVERY & LIQUIDACIONES (UBER EATS, RAPPI, DIDI FOOD) */}
        {activeTab === 'AUDIT' && (
          <DeliveryReconciliationTab />
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

        {/* TAB 5: CFDI 4.0 FISCAL CONSOLE (CONFIG, GLOBAL INVOICING & CANCELLATIONS) */}
        {activeTab === 'INVOICING' && (
          <FiscalConsole
            activeBrand={activeBrand}
            addNotification={addNotification}
            onConfigUpdated={loadInvoicingConfig}
          />
        )}

        {/* TAB 6: HARDWARE BRIDGE & PRINTERS */}
        {activeTab === 'PRINTERS' && (
          <div className="space-y-6">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Printer className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-bold text-white">Red de Impresoras Térmicas ESC/POS</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Impresión desatendida por socket TCP directo (puerto 9100). Comanderas de cocina por estación, corte de papel automático y apertura de gaveta.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin text-cyan-400' : ''}`} />
                  Refrescar
                </button>
                <button
                  type="button"
                  onClick={openCreatePrinterModal}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Impresora LAN
                </button>
              </div>
            </div>

            {/* Architecture Banner */}
            <div className="bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-slate-900/20">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Hardware Bridge Directo (Zero-Dependency)
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">Socket TCP 9100</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    DarkFlow se comunica directamente con cualquier impresora térmica LAN/WiFi (Epson, Star, Bixolon, Xprinter, Rongta) enviando comandos binarios ESC/POS nativos con control de corte y apertura de cajón.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                  Anchos: 80mm & 58mm
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                  Corte: GS V 66 0
                </span>
              </div>
            </div>

            {/* Printers Grid */}
            {printers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mx-auto flex items-center justify-center">
                  <Printer className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">No hay impresoras registradas</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Agrega tu primera impresora de red especificando su dirección IP local (ej. 192.168.1.200) y asigna su estación de comanda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreatePrinterModal}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Impresora LAN
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {printers.map((p) => {
                  const isTesting = testingPrinterId === p.id;
                  const isOnline = p.status === 'ONLINE';

                  return (
                    <div
                      key={p.id}
                      className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                        p.isActive
                          ? 'border-slate-800 hover:border-slate-700 shadow-lg shadow-black/20'
                          : 'border-slate-800/50 opacity-60'
                      }`}
                    >
                      <div className="space-y-4">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                              <Printer className="w-5 h-5" />
                            </span>
                            <div>
                              <h4 className="font-bold text-white text-sm">{p.name}</h4>
                              <p className="font-mono text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                {p.connectionType === 'VIRTUAL' ? (
                                  <span className="text-purple-400">Emulador Virtual</span>
                                ) : (
                                  <>
                                    <span>{p.ipAddress}:{p.port}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              isOnline
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                              {p.status}
                            </span>
                            {!p.isActive && (
                              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Inactiva</span>
                            )}
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">Estación KDS</span>
                            <span className="font-bold text-slate-200">{p.targetStation}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">Papel</span>
                            <span className="font-mono font-bold text-cyan-400">{p.paperWidth}</span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Disparador:</span>
                            <span className="text-[11px] font-mono text-slate-300">
                              {p.autoPrintTrigger === 'ON_ORDER_CREATED' ? 'Al Crear Pedido' :
                               p.autoPrintTrigger === 'ON_STAGE_MARCHED' ? 'Al Marchar Tiempo' :
                               p.autoPrintTrigger === 'ON_PAYMENT_CLOSED' ? 'Al Cobrar Ticket' : 'Manual'}
                            </span>
                          </div>
                        </div>

                        {/* Last tested info */}
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Última prueba:</span>
                          <span className="font-mono text-slate-400">
                            {p.lastTestedAt ? new Date(p.lastTestedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTestPrinter(p.id, 'PRINT_TEST')}
                            disabled={isTesting}
                            title="Enviar ticket de prueba ESC/POS"
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
                          >
                            <Play className={`w-3 h-3 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
                            {isTesting ? 'Enviando...' : 'Prueba'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTestPrinter(p.id, 'KICK_DRAWER')}
                            disabled={isTesting}
                            title="Pulso de apertura de cajón (RJ11 / RJ12)"
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
                          >
                            <Terminal className="w-3 h-3 text-amber-400" />
                            Cajón
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditPrinterModal(p)}
                            title="Editar configuración"
                            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition-all"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePrinter(p.id)}
                            title="Eliminar impresora"
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs border border-red-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PRINTER MODAL (Create / Edit) */}
        {printerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Printer className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {editingPrinter ? 'Editar Impresora Térmica' : 'Registrar Impresora de Red (ESC/POS)'}
                    </h3>
                    <p className="text-xs text-slate-400">Configuración de socket LAN y ruteo de comandas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrinterModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSavePrinter} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre Descriptivo *
                  </label>
                  <input
                    type="text"
                    required
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    placeholder="Ej. Comandera Cocina Caliente, Barra Bebidas, Caja Principal"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tipo de Conexión
                    </label>
                    <select
                      value={printerConnType}
                      onChange={(e) => setPrinterConnType(e.target.value as 'NETWORK' | 'VIRTUAL')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="NETWORK">Socket TCP / LAN</option>
                      <option value="VIRTUAL">Emulador Virtual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Ancho de Papel
                    </label>
                    <select
                      value={printerWidth}
                      onChange={(e) => setPrinterWidth(e.target.value as '80mm' | '58mm')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="80mm">80 mm (48 columnas)</option>
                      <option value="58mm">58 mm (32 columnas)</option>
                    </select>
                  </div>
                </div>

                {printerConnType === 'NETWORK' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Dirección IP Local *
                      </label>
                      <input
                        type="text"
                        required
                        value={printerIp}
                        onChange={(e) => setPrinterIp(e.target.value)}
                        placeholder="192.168.1.200"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Puerto TCP
                      </label>
                      <input
                        type="number"
                        required
                        value={printerPort}
                        onChange={(e) => setPrinterPort(Number(e.target.value))}
                        placeholder="9100"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Estación Asignada (KDS)
                    </label>
                    <select
                      value={printerStation}
                      onChange={(e) => setPrinterStation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ALL">TODAS (General)</option>
                      <option value="COCINA">COCINA</option>
                      <option value="PARRILLA">PARRILLA</option>
                      <option value="BARRA">BARRA</option>
                      <option value="POSTRES">POSTRES</option>
                      <option value="ENSALADAS">ENSALADAS</option>
                      <option value="CASHIER">CAJA / TICKETS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Disparador Automático
                    </label>
                    <select
                      value={printerTrigger}
                      onChange={(e) => setPrinterTrigger(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ON_ORDER_CREATED">Al Crear Pedido (Inmediato)</option>
                      <option value="ON_STAGE_MARCHED">Al Marchar Tiempo KDS</option>
                      <option value="ON_PAYMENT_CLOSED">Al Liquidar Pago</option>
                      <option value="MANUAL">Solo Impresión Manual</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Notas u Observaciones
                  </label>
                  <input
                    type="text"
                    value={printerNotes}
                    onChange={(e) => setPrinterNotes(e.target.value)}
                    placeholder="Ubicación física, modelo o notas de instalación"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="printerActiveCheckbox"
                    checked={printerIsActive}
                    onChange={(e) => setPrinterIsActive(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                  />
                  <label htmlFor="printerActiveCheckbox" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    Impresora Habilitada para Operación en Vivo
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPrinterModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingPrinter}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-900/30 transition-all flex items-center gap-2"
                  >
                    {savingPrinter ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      editingPrinter ? 'Guardar Cambios' : 'Registrar Impresora'
                    )}
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

