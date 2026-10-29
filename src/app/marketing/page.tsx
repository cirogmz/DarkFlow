'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardContainer from '@/components/DashboardContainer';
import {
  Megaphone,
  Send,
  Users,
  Sparkles,
  Cake,
  Clock,
  Crown,
  Award,
  Shield,
  MessageSquare,
  Mail,
  Smartphone,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Gift,
  Tag,
  Copy,
  Check,
  Eye,
  Trash2,
  Calendar,
  Percent,
  Coins,
  ChevronRight,
  TrendingUp,
  X,
  Play,
  Flame,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  MARKETING_SEGMENTS,
  TEMPLATE_PRESETS,
  TargetSegment,
  CampaignChannel,
  CampaignTriggerType,
  MessageTemplatePreset,
} from '@/lib/marketingConstants';

interface CampaignRecipientDTO {
  id: string;
  customerId: string | null;
  customerName: string;
  phone: string | null;
  email: string | null;
  status: string;
  couponCode: string | null;
  customMessage: string | null;
  whatsappUrl: string | null;
  sentAt: string | null;
  convertedAt: string | null;
}

interface CampaignDTO {
  id: string;
  folio: string;
  name: string;
  channel: CampaignChannel;
  triggerType: CampaignTriggerType;
  status: string;
  targetSegment: TargetSegment;
  subject: string | null;
  messageTemplate: string;
  couponCode: string | null;
  discountPct: number | null;
  walletBonusAmount: number | null;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  clicksCount: number;
  conversionsCount: number;
  brandId: string;
  brand?: {
    id: string;
    name: string;
    slug: string;
  };
  recipients?: CampaignRecipientDTO[];
  createdAt: string;
}

interface AudienceMemberDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  tier: string;
  walletBalance: number;
  totalSpent: number;
  totalOrders: number;
  birthDate: string | null;
  lastOrderDate: string | null;
}

export default function MarketingPage() {
  const { activeBrand, addNotification } = useAppStore();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'new_campaign' | 'automations' | 'audiences'>('campaigns');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignDTO[]>([]);
  const [kpis, setKpis] = useState({
    totalCampaigns: 0,
    totalSent: 0,
    totalClicks: 0,
    totalConversions: 0,
    conversionRatePct: 0,
  });

  // Audience & Segments State
  const [audienceCounts, setAudienceCounts] = useState<Record<TargetSegment, number>>({
    ALL: 0,
    BIRTHDAY_MONTH: 0,
    INACTIVE_30_DAYS: 0,
    VIP_PLATINUM: 0,
    VIP_GOLD: 0,
    VIP_SILVER: 0,
    TOP_SPENDERS: 0,
  });
  const [selectedAudienceSegment, setSelectedAudienceSegment] = useState<TargetSegment>('ALL');
  const [audienceSample, setAudienceSample] = useState<AudienceMemberDTO[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // New Campaign Form State
  const [formData, setFormData] = useState({
    name: '',
    channel: 'WHATSAPP' as CampaignChannel,
    triggerType: 'MANUAL' as CampaignTriggerType,
    targetSegment: 'ALL' as TargetSegment,
    subject: '',
    messageTemplate: '',
    discountPct: 15,
    walletBonusAmount: 0,
    couponCode: '',
  });

  // Modal State for viewing Recipients & WhatsApp links
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDTO | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Filters for campaigns list
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch campaigns and KPIs
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const brandParam = activeBrand?.id ? `?brandId=${activeBrand.id}` : '';
      const res = await fetch(`/api/marketing/campaigns${brandParam}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        if (data.kpis) {
          setKpis(data.kpis);
        }
      }
    } catch (err) {
      console.error('Error loading marketing campaigns:', err);
      addNotification('Error al cargar campañas de marketing', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeBrand, addNotification]);

  // 2. Fetch audience counts and sample
  const fetchAudience = useCallback(async (segment: TargetSegment = 'ALL') => {
    try {
      setAudienceLoading(true);
      const brandParam = activeBrand?.id ? `&brandId=${activeBrand.id}` : '';
      const res = await fetch(`/api/marketing/audiences?segment=${segment}${brandParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setAudienceCounts(data.counts);
        }
        setAudienceSample(data.sample || []);
        setSelectedAudienceSegment(segment);
      }
    } catch (err) {
      console.error('Error fetching audience stats:', err);
    } finally {
      setAudienceLoading(false);
    }
  }, [activeBrand]);

  useEffect(() => {
    fetchCampaigns();
    fetchAudience(selectedAudienceSegment);
  }, [fetchCampaigns, fetchAudience, selectedAudienceSegment]);

  // Open detailed campaign recipient modal
  const handleOpenRecipientsModal = async (campaign: CampaignDTO) => {
    setSelectedCampaign(campaign);
    setRecipientsLoading(true);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCampaign(data.campaign);
      }
    } catch (err) {
      console.error('Error loading campaign recipients:', err);
    } finally {
      setRecipientsLoading(false);
    }
  };

  // Launch campaign handler
  const handleLaunchCampaign = async (campaignId: string) => {
    if (!confirm('¿Estás seguro de lanzar esta campaña masiva ahora? Se generarán los cupones y los enlaces personalizados.')) {
      return;
    }
    setLaunchingId(campaignId);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/launch`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        addNotification(data.message || 'Campaña lanzada con éxito', 'success');
        fetchCampaigns();
        fetchAudience(selectedAudienceSegment);
        if (selectedCampaign?.id === campaignId) {
          setSelectedCampaign(data.campaign);
        }
      } else {
        addNotification(data.error || 'Error al lanzar campaña', 'error');
      }
    } catch (err) {
      console.error('Error launching campaign:', err);
      addNotification('Ocurrió un error al lanzar la campaña', 'error');
    } finally {
      setLaunchingId(null);
    }
  };

  // Create Campaign Form Submit
  const handleCreateCampaignSubmit = async (launchImmediate = false) => {
    if (!formData.name.trim()) {
      addNotification('Ingresa un nombre para la campaña', 'error');
      return;
    }
    if (!formData.messageTemplate.trim()) {
      addNotification('Ingresa la plantilla del mensaje', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          brandId: activeBrand?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addNotification(data.error || 'Error al crear campaña', 'error');
        return;
      }

      addNotification(`Campaña "${formData.name}" guardada con éxito`, 'success');

      if (launchImmediate && data.campaign?.id) {
        await handleLaunchCampaign(data.campaign.id);
      }

      // Reset form
      setFormData({
        name: '',
        channel: 'WHATSAPP',
        triggerType: 'MANUAL',
        targetSegment: 'ALL',
        subject: '',
        messageTemplate: '',
        discountPct: 15,
        walletBonusAmount: 0,
        couponCode: '',
      });

      setActiveTab('campaigns');
      fetchCampaigns();
      fetchAudience(selectedAudienceSegment);
    } catch (err) {
      console.error('Error creating campaign:', err);
      addNotification('Error al crear campaña', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load Preset Template
  const applyPreset = (preset: MessageTemplatePreset) => {
    setFormData((prev) => ({
      ...prev,
      name: preset.name.replace(/^[^\w\s]+/, '').trim() + ' ' + new Date().toLocaleDateString('es-MX', { month: 'short' }),
      channel: preset.channel,
      triggerType: preset.triggerType,
      targetSegment: preset.targetSegment,
      subject: preset.defaultSubject,
      messageTemplate: preset.template,
      discountPct: preset.suggestedDiscount || prev.discountPct,
      walletBonusAmount: preset.suggestedWalletBonus || prev.walletBonusAmount,
    }));
    addNotification(`Plantilla "${preset.name}" cargada`, 'info');
  };

  // Helper to insert token in message template
  const insertToken = (token: string) => {
    setFormData((prev) => ({
      ...prev,
      messageTemplate: prev.messageTemplate + ` {{${token}}} `,
    }));
  };

  // Live Preview Message with simulated customer
  const sampleCustomer = {
    nombre: 'Carlos Hernández',
    marca: activeBrand?.name || 'DarkFlow Burgers',
    cupon: formData.couponCode || 'PROMO-2026',
    saldo_monedero: '$85.00 MXN',
    link_menu: `https://darkflow.app/${activeBrand?.slug || 'demo'}/menu`,
    descuento: `${formData.discountPct}`,
  };

  const getSimulatedMessage = () => {
    let msg = formData.messageTemplate || 'Escribe tu mensaje para ver la vista previa en vivo...';
    msg = msg.replace(/\{\{nombre\}\}/gi, sampleCustomer.nombre);
    msg = msg.replace(/\{\{marca\}\}/gi, sampleCustomer.marca);
    msg = msg.replace(/\{\{cupon\}\}/gi, sampleCustomer.cupon);
    msg = msg.replace(/\{\{saldo_monedero\}\}/gi, sampleCustomer.saldo_monedero);
    msg = msg.replace(/\{\{link_menu\}\}/gi, sampleCustomer.link_menu);
    msg = msg.replace(/\{\{descuento\}\}/gi, sampleCustomer.descuento);
    return msg;
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    if (filterChannel !== 'ALL' && c.channel !== filterChannel) return false;
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.folio.toLowerCase().includes(q) ||
        c.targetSegment.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <DashboardContainer>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-primary/20 to-emerald-500/10 border border-brand-primary/30 text-brand-primary">
                <Megaphone className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Marketing Masivo & Segmentación VIP
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Fase 52 • WhatsApp & Email
                  </span>
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Automatiza campañas de retención, Club de Cumpleaños, reactivación de inactivos (+30d) y cupones dinámicos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                fetchCampaigns();
                fetchAudience(selectedAudienceSegment);
              }}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Actualizar métricas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setActiveTab('new_campaign')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-brand-primary/20 transition"
            >
              <Plus className="w-4 h-4" />
              Crear Campaña
            </button>
          </div>
        </div>

        {/* Quick KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Campañas Totales</span>
              <Megaphone className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {kpis.totalCampaigns}
            </div>
            <span className="text-[11px] text-slate-500">Histórico de envíos</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Mensajes Enviados</span>
              <Send className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {kpis.totalSent.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500">WhatsApp & Correo</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Conversiones Registradas</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400 mt-2">
              {kpis.totalConversions}
            </div>
            <span className="text-[11px] text-slate-500">Pedidos con cupón</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Tasa de Conversión</span>
              <Percent className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">
              {kpis.conversionRatePct}%
            </div>
            <span className="text-[11px] text-slate-500">Efectividad global</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Audiencia Disponible</span>
              <Users className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {audienceCounts.ALL.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500">Contactos con teléfono</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'campaigns'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Campañas & Historial ({campaigns.length})
          </button>

          <button
            onClick={() => setActiveTab('new_campaign')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'new_campaign'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            Creador Táctil de Campañas
          </button>

          <button
            onClick={() => setActiveTab('automations')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'automations'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Automatizaciones Activas
          </button>

          <button
            onClick={() => setActiveTab('audiences')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'audiences'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Segmentos & Audiencias
          </button>
        </div>

        {/* TAB 1: CAMPAIGNS & HISTORY */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar campaña por nombre, folio o segmento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-brand-primary"
                >
                  <option value="ALL">Todos los Canales</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-brand-primary"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="SENT">Enviadas</option>
                  <option value="DRAFT">Borradores</option>
                  <option value="SCHEDULED">Programadas</option>
                </select>
              </div>
            </div>

            {/* Campaigns Table */}
            {filteredCampaigns.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
                <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">No hay campañas registradas</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
                  Crea tu primera campaña automatizada con cupones dinámicos para disparar las ventas.
                </p>
                <button
                  onClick={() => setActiveTab('new_campaign')}
                  className="mt-4 px-4 py-2 bg-brand-primary text-slate-950 font-bold rounded-xl text-sm hover:brightness-110 transition"
                >
                  Crear mi primera campaña
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 font-semibold">Campaña & Folio</th>
                        <th className="py-3.5 px-4 font-semibold">Canal & Segmento</th>
                        <th className="py-3.5 px-4 font-semibold">Incentivo</th>
                        <th className="py-3.5 px-4 font-semibold">Alcance & Conversión</th>
                        <th className="py-3.5 px-4 font-semibold">Estado</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredCampaigns.map((camp) => {
                        const segInfo = MARKETING_SEGMENTS[camp.targetSegment] || {
                          name: camp.targetSegment,
                          badgeColor: 'bg-slate-800 text-slate-300',
                        };

                        const convRate = camp.sentCount > 0
                          ? ((camp.conversionsCount / camp.sentCount) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <tr key={camp.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-4 px-4">
                              <div className="font-bold text-white flex items-center gap-2">
                                {camp.name}
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                {camp.folio} • {new Date(camp.createdAt).toLocaleDateString('es-MX')}
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 mb-1">
                                {camp.channel === 'WHATSAPP' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <Smartphone className="w-3 h-3" /> WhatsApp
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    <Mail className="w-3 h-3" /> Correo
                                  </span>
                                )}
                              </div>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${segInfo.badgeColor}`}>
                                {segInfo.name}
                              </span>
                            </td>

                            <td className="py-4 px-4">
                              {camp.discountPct ? (
                                <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                  <Tag className="w-3.5 h-3.5" />
                                  {camp.discountPct}% OFF
                                  {camp.couponCode && (
                                    <span className="text-[10px] text-slate-400 font-mono">({camp.couponCode})</span>
                                  )}
                                </div>
                              ) : null}
                              {camp.walletBonusAmount ? (
                                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                                  <Coins className="w-3.5 h-3.5" />
                                  +${camp.walletBonusAmount} Monedero
                                </div>
                              ) : null}
                              {!camp.discountPct && !camp.walletBonusAmount && (
                                <span className="text-xs text-slate-500">Informativa</span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              <div className="text-xs font-bold text-white">
                                {camp.sentCount} / {camp.totalRecipients} enviados
                              </div>
                              <div className="text-[11px] text-purple-400 flex items-center gap-1 mt-0.5">
                                <TrendingUp className="w-3 h-3" />
                                {camp.conversionsCount} ventas ({convRate}%)
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              {camp.status === 'SENT' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" /> Enviada
                                </span>
                              ) : camp.status === 'SCHEDULED' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  <Clock className="w-3 h-3" /> Programada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/40">
                                  Borrador
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenRecipientsModal(camp)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                  title="Ver destinatarios y enlaces WhatsApp"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {camp.status !== 'SENT' && (
                                  <button
                                    onClick={() => handleLaunchCampaign(camp.id)}
                                    disabled={launchingId === camp.id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-primary text-slate-950 font-bold text-xs hover:brightness-110 transition disabled:opacity-50"
                                    title="Lanzar campaña masiva"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    Lanzar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TACTILE CAMPAIGN CREATOR */}
        {activeTab === 'new_campaign' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-5">
              {/* Preset Selector */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                  Plantillas Rápidas Preconfiguradas
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className="text-left p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-brand-primary/50 hover:bg-slate-800/40 transition group"
                    >
                      <div className="font-bold text-xs text-white group-hover:text-brand-primary">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {preset.channel} • {preset.targetSegment}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campaign Settings Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                  Configuración de la Campaña
                </h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Nombre Interno de la Campaña *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Cumpleañeros Octubre 2026 - Cupón 20% OFF"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Canal de Difusión
                    </label>
                    <select
                      value={formData.channel}
                      onChange={(e) => setFormData({ ...formData, channel: e.target.value as CampaignChannel })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-primary"
                    >
                      <option value="WHATSAPP">WhatsApp (Click-to-Chat)</option>
                      <option value="EMAIL">Email Marketing</option>
                      <option value="SMS">SMS Texto</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Tipo de Detonador
                    </label>
                    <select
                      value={formData.triggerType}
                      onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as CampaignTriggerType })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-primary"
                    >
                      <option value="MANUAL">Disparo Manual</option>
                      <option value="BIRTHDAY_TRIGGER">Club de Cumpleaños</option>
                      <option value="INACTIVE_RECOVERY">Reactivación Inactivos</option>
                      <option value="VIP_PROMOTION">Exclusiva VIP</option>
                    </select>
                  </div>
                </div>

                {/* Target Segment Selector with Live Audience Badges */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Segmento Objetivo de Clientes</span>
                    <span className="text-[11px] text-brand-primary font-bold">
                      {audienceCounts[formData.targetSegment] || 0} clientes elegibles
                    </span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(Object.keys(MARKETING_SEGMENTS) as TargetSegment[]).map((segKey) => {
                      const seg = MARKETING_SEGMENTS[segKey];
                      const isSelected = formData.targetSegment === segKey;
                      const count = audienceCounts[segKey] || 0;

                      return (
                        <button
                          key={segKey}
                          type="button"
                          onClick={() => setFormData({ ...formData, targetSegment: segKey })}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            isSelected
                              ? 'bg-brand-primary/10 border-brand-primary text-white shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate">{seg.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Incentives */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-400" />
                    Incentivo de Conversión (Cupón o Monedero)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Descuento Cupón (% OFF)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.discountPct}
                        onChange={(e) => setFormData({ ...formData, discountPct: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Bono Directo en Monedero ($ MXN)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.walletBonusAmount}
                        onChange={(e) => setFormData({ ...formData, walletBonusAmount: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Message Template Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Plantilla del Mensaje *
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Etiquetas dinámicas disponibles:
                    </span>
                  </div>

                  {/* Token Quick Insertion Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {['nombre', 'marca', 'cupon', 'saldo_monedero', 'link_menu', 'descuento'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertToken(tag)}
                        className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-brand-primary rounded-md border border-slate-700 transition"
                      >
                        +{`{{${tag}}}`}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={5}
                    placeholder="Escribe el mensaje personalizado. Ejemplo: ¡Hola {{nombre}}! Celebramos tu cumpleaños en {{marca}} con {{descuento}}% OFF usando tu cupón {{cupon}}."
                    value={formData.messageTemplate}
                    onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary resize-none"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCreateCampaignSubmit(false)}
                    disabled={loading}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition"
                  >
                    Guardar Borrador
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateCampaignSubmit(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-slate-950 font-bold rounded-xl text-sm hover:brightness-110 shadow-lg shadow-brand-primary/20 transition"
                  >
                    <Send className="w-4 h-4" />
                    Lanzar Inmediatamente
                  </button>
                </div>
              </div>
            </div>

            {/* Live WhatsApp Smartphone Preview Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Simulador en Vivo (WhatsApp Preview)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Así se verá el mensaje en el teléfono del comensal con las variables interpoladas automáticamente:
                </p>

                {/* Smartphone Device Mockup */}
                <div className="mx-auto max-w-[280px] sm:max-w-[320px] bg-slate-950 rounded-[36px] border-4 border-slate-800 p-3 shadow-2xl relative">
                  {/* Speaker Notch */}
                  <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3"></div>

                  {/* WhatsApp Chat Header */}
                  <div className="bg-slate-900 rounded-t-xl p-2.5 flex items-center gap-2 border-b border-slate-800">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      DF
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {activeBrand?.name || 'DarkFlow Burgers'}
                      </div>
                      <div className="text-[10px] text-emerald-400 leading-tight">En línea</div>
                    </div>
                  </div>

                  {/* Chat Wallpaper / Bubble */}
                  <div className="bg-[#0b141a] p-3 rounded-b-xl min-h-[220px] flex flex-col justify-end">
                    <div className="bg-[#005c4b] text-white p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed shadow-md space-y-2">
                      <div className="whitespace-pre-wrap">{getSimulatedMessage()}</div>
                      <div className="text-[9px] text-emerald-200/80 text-right">
                        {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} • ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVE AUTOMATIONS */}
        {activeTab === 'automations' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-sm text-slate-300">
              <span className="font-bold text-white">Automatizaciones de Retención Multi-Marca:</span>{' '}
              Estas reglas monitorean las fechas de cumpleaños de tus comensales y el tiempo transcurrido desde su última visita para enviarles incentivos automatizados por WhatsApp.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rule 1: Birthday Club */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                      <Cake className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      Activa
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white">Club de Cumpleaños</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Detecta comensales que cumplen años este mes y genera cupón dinámico del 20% OFF.
                  </p>
                  <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Audiencia este mes:</span>
                      <strong className="text-white">{audienceCounts.BIRTHDAY_MONTH} comensales</strong>
                    </div>
                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Incentivo:</span>
                      <strong className="text-pink-400">20% Descuento</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    applyPreset(TEMPLATE_PRESETS[0]);
                    setActiveTab('new_campaign');
                  }}
                  className="mt-5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Disparar Campaña de Cumpleaños
                </button>
              </div>

              {/* Rule 2: Inactive Winback */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      Activa
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white">Reactivación de Inactivos (+30d)</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Recupera comensales que llevan más de 30 días sin ordenar mediante mensaje cálido y cupón express.
                  </p>
                  <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Comensales inactivos:</span>
                      <strong className="text-white">{audienceCounts.INACTIVE_30_DAYS} clientes</strong>
                    </div>
                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Incentivo:</span>
                      <strong className="text-amber-400">15% Descuento</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    applyPreset(TEMPLATE_PRESETS[1]);
                    setActiveTab('new_campaign');
                  }}
                  className="mt-5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Disparar Reactivación Inactivos
                </button>
              </div>

              {/* Rule 3: VIP Loyalty Perk */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Crown className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      Activa
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white">Mimo VIP Platinum</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Otorga bono sorpresa en monedero digital a clientes Platinum para premiar su fidelidad continua.
                  </p>
                  <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Clientes VIP:</span>
                      <strong className="text-white">{audienceCounts.VIP_PLATINUM} comensales</strong>
                    </div>
                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Incentivo:</span>
                      <strong className="text-purple-400">$50 Monedero Digital</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    applyPreset(TEMPLATE_PRESETS[2]);
                    setActiveTab('new_campaign');
                  }}
                  className="mt-5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Premiar Clientes VIP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SEGMENTS & AUDIENCES */}
        {activeTab === 'audiences' && (
          <div className="space-y-5">
            {/* Segments Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(MARKETING_SEGMENTS) as TargetSegment[]).map((segKey) => {
                const seg = MARKETING_SEGMENTS[segKey];
                const count = audienceCounts[segKey] || 0;
                const isSelected = selectedAudienceSegment === segKey;

                return (
                  <button
                    key={segKey}
                    onClick={() => fetchAudience(segKey)}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'bg-slate-900 border-brand-primary shadow-lg ring-1 ring-brand-primary'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${seg.badgeColor}`}>
                        {seg.name}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-white">{count}</div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {seg.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Audience Members Table */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">
                    Comensales en: {MARKETING_SEGMENTS[selectedAudienceSegment]?.name || selectedAudienceSegment}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Mostrando muestra de hasta 50 contactos para verificación
                  </span>
                </div>

                <button
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      targetSegment: selectedAudienceSegment,
                    }));
                    setActiveTab('new_campaign');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-slate-950 font-bold rounded-xl text-xs hover:brightness-110 transition"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Enviar a este segmento
                </button>
              </div>

              {audienceLoading ? (
                <div className="text-center py-10 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-primary" />
                  Cargando miembros del segmento...
                </div>
              ) : audienceSample.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  No hay clientes que cumplan con los criterios de este segmento actualmente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Contacto</th>
                        <th className="py-2.5 px-3">Nivel VIP</th>
                        <th className="py-2.5 px-3">Consumo Total</th>
                        <th className="py-2.5 px-3">Monedero</th>
                        <th className="py-2.5 px-3">Cumpleaños</th>
                        <th className="py-2.5 px-3">Última Visita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {audienceSample.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {c.phone || c.email || 'Sin contacto'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-amber-400">{c.tier}</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-bold">
                            ${c.totalSpent.toFixed(2)} MXN
                          </td>
                          <td className="py-2.5 px-3 text-purple-400 font-bold">
                            ${c.walletBalance.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {c.birthDate || 'No registrada'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {c.lastOrderDate
                              ? new Date(c.lastOrderDate).toLocaleDateString('es-MX')
                              : 'Sin pedidos'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: VIEW CAMPAIGN RECIPIENTS & 1-CLICK WHATSAPP DISPATCH */}
        {selectedCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    {selectedCampaign.name}
                    <span className="text-xs font-mono font-normal text-slate-400">
                      ({selectedCampaign.folio})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Canal: <strong className="text-white">{selectedCampaign.channel}</strong> • Segmento:{' '}
                    <strong className="text-brand-primary">{selectedCampaign.targetSegment}</strong> •{' '}
                    {selectedCampaign.sentCount} destinatarios procesados
                  </p>
                </div>

                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o teléfono de comensal..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                  />
                </div>
                {selectedCampaign.status !== 'SENT' && (
                  <button
                    onClick={() => handleLaunchCampaign(selectedCampaign.id)}
                    disabled={launchingId === selectedCampaign.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-slate-950 font-bold rounded-xl text-xs hover:brightness-110 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Lanzar Campaña
                  </button>
                )}
              </div>

              {/* Recipients List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {recipientsLoading ? (
                  <div className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-primary" />
                    Cargando destinatarios...
                  </div>
                ) : (!selectedCampaign.recipients || selectedCampaign.recipients.length === 0) ? (
                  <div className="text-center py-12 text-slate-500">
                    Esta campaña está en borrador y aún no ha sido disparada a la audiencia.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCampaign.recipients
                      .filter((r) => {
                        if (!recipientSearch.trim()) return true;
                        const q = recipientSearch.toLowerCase();
                        return (
                          r.customerName.toLowerCase().includes(q) ||
                          (r.phone && r.phone.includes(q))
                        );
                      })
                      .map((recipient) => (
                        <div
                          key={recipient.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {recipient.customerName}
                              </span>
                              {recipient.couponCode && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {recipient.couponCode}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                                {recipient.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {recipient.phone || recipient.email || 'Sin contacto'}
                            </div>
                            {recipient.customMessage && (
                              <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg italic">
                                &quot;{recipient.customMessage}&quot;
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {recipient.whatsappUrl && (
                              <a
                                href={recipient.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                Abrir WhatsApp
                                <ExternalLink className="w-3 h-3 ml-0.5" />
                              </a>
                            )}
                            {recipient.customMessage && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(recipient.customMessage || '');
                                  setCopiedId(recipient.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                                title="Copiar mensaje"
                              >
                                {copiedId === recipient.id ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardContainer>
  );
}

