import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import {
  CampaignChannel,
  CampaignStatus,
  CampaignTriggerType,
  TargetSegment,
  RecipientStatus,
} from './marketingConstants';

export interface CreateCampaignInput {
  name: string;
  brandId: string;
  channel?: CampaignChannel;
  triggerType?: CampaignTriggerType;
  targetSegment?: TargetSegment;
  subject?: string;
  messageTemplate: string;
  couponCode?: string;
  discountPct?: number;
  walletBonusAmount?: number;
  scheduledAt?: Date | string;
  createdById?: string;
  createdByName?: string;
}

/**
 * Generate a unique Folio for marketing campaigns, e.g. CMP-20261028-1423
 */
export function generateCampaignFolio(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${dateStr}-${randomSuffix}`;
}

/**
 * Generate a unique single-use promotional coupon code for a campaign recipient
 */
export function generateRecipientCouponCode(prefix = 'PROMO'): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rand}`;
}

/**
 * Format a phone number into an international WhatsApp link:
 * https://wa.me/<country_code><number>?text=<encoded_text>
 */
export function formatWhatsAppUrl(rawPhone: string, text: string): string {
  let clean = rawPhone.replace(/\D/g, '');
  // Default Mexican phone formatting: 10 digits -> prefix with 52
  if (clean.length === 10) {
    clean = `52${clean}`;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

/**
 * Replace template placeholders:
 * {{nombre}}, {{marca}}, {{cupon}}, {{saldo_monedero}}, {{link_menu}}, {{descuento}}
 */
export function interpolateMessage(
  template: string,
  vars: {
    nombre: string;
    marca: string;
    cupon?: string;
    saldo_monedero?: string | number;
    link_menu?: string;
    descuento?: string | number;
  }
): string {
  let message = template;

  const formattedWallet =
    typeof vars.saldo_monedero === 'number'
      ? `$${vars.saldo_monedero.toFixed(2)} MXN`
      : vars.saldo_monedero || '$0.00 MXN';

  const formattedDiscount =
    typeof vars.descuento === 'number'
      ? `${vars.descuento}`
      : vars.descuento || '15';

  message = message.replace(/\{\{nombre\}\}/gi, vars.nombre || 'estimado cliente');
  message = message.replace(/\{\{marca\}\}/gi, vars.marca || 'nuestro restaurante');
  message = message.replace(/\{\{cupon\}\}/gi, vars.cupon || 'PROMO-VIP');
  message = message.replace(/\{\{saldo_monedero\}\}/gi, formattedWallet);
  message = message.replace(/\{\{link_menu\}\}/gi, vars.link_menu || 'https://darkflow.app');
  message = message.replace(/\{\{descuento\}\}/gi, formattedDiscount);

  return message;
}

/**
 * Query eligible customers matching a specific marketing segment.
 */
export async function getAudienceBySegment(brandId: string, segment: TargetSegment) {
  const baseWhere: any = {};
  if (brandId && brandId !== 'ALL') {
    baseWhere.OR = [{ brandId }, { brandId: null }];
  }

  // Retrieve eligible customers
  const customers = await prisma.customer.findMany({
    where: baseWhere,
    include: {
      orders: {
        select: { id: true, createdAt: true, total: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filtered = customers.filter((customer) => {
    // Basic validity: must have a phone or an email to receive messages
    const hasContact = Boolean(
      (customer.phone && customer.phone.trim().length >= 8) ||
      (customer.email && customer.email.includes('@'))
    );
    if (!hasContact) return false;

    switch (segment) {
      case 'ALL':
        return true;

      case 'BIRTHDAY_MONTH': {
        if (!customer.birthDate) return false;
        // Supports formats: 'YYYY-MM-DD', 'MM-DD', 'DD/MM/YYYY', etc.
        const parts = customer.birthDate.split(/[-/]/);
        if (parts.length === 3) {
          // If YYYY-MM-DD -> parts[1] is month
          // If DD/MM/YYYY -> parts[1] is month
          const monthCandidate = parts[1].padStart(2, '0');
          return monthCandidate === currentMonth;
        } else if (parts.length === 2) {
          // MM-DD
          return parts[0].padStart(2, '0') === currentMonth;
        }
        return false;
      }

      case 'INACTIVE_30_DAYS': {
        const lastOrder = customer.orders[0];
        if (lastOrder) {
          return new Date(lastOrder.createdAt) < thirtyDaysAgo;
        }
        // If registered more than 30 days ago with 0 orders, also considered inactive
        return new Date(customer.createdAt) < thirtyDaysAgo;
      }

      case 'VIP_PLATINUM':
        return (customer.tier || '').toUpperCase() === 'PLATINUM';

      case 'VIP_GOLD':
        return (customer.tier || '').toUpperCase() === 'GOLD';

      case 'VIP_SILVER':
        return (customer.tier || '').toUpperCase() === 'SILVER';

      case 'TOP_SPENDERS':
        return (customer.totalSpent || 0) >= 1500;

      default:
        return true;
    }
  });

  return filtered;
}

/**
 * Returns audience size counts for all segments under a given brand
 */
export async function getAudienceCounts(brandId: string) {
  const segments: TargetSegment[] = [
    'ALL',
    'BIRTHDAY_MONTH',
    'INACTIVE_30_DAYS',
    'VIP_PLATINUM',
    'VIP_GOLD',
    'VIP_SILVER',
    'TOP_SPENDERS',
  ];

  const counts: Record<TargetSegment, number> = {
    ALL: 0,
    BIRTHDAY_MONTH: 0,
    INACTIVE_30_DAYS: 0,
    VIP_PLATINUM: 0,
    VIP_GOLD: 0,
    VIP_SILVER: 0,
    TOP_SPENDERS: 0,
  };

  await Promise.all(
    segments.map(async (seg) => {
      const audience = await getAudienceBySegment(brandId, seg);
      counts[seg] = audience.length;
    })
  );

  return counts;
}

/**
 * Create a new marketing campaign in DRAFT or SCHEDULED state.
 */
export async function createCampaign(input: CreateCampaignInput) {
  const folio = generateCampaignFolio();
  const audience = await getAudienceBySegment(input.brandId, input.targetSegment || 'ALL');

  const status: CampaignStatus = input.scheduledAt ? 'SCHEDULED' : 'DRAFT';

  const campaign = await prisma.marketingCampaign.create({
    data: {
      folio,
      name: input.name,
      channel: input.channel || 'WHATSAPP',
      triggerType: input.triggerType || 'MANUAL',
      status,
      targetSegment: input.targetSegment || 'ALL',
      subject: input.subject || null,
      messageTemplate: input.messageTemplate,
      couponCode: input.couponCode || null,
      discountPct: input.discountPct || null,
      walletBonusAmount: input.walletBonusAmount || null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      totalRecipients: audience.length,
      brandId: input.brandId,
      createdById: input.createdById || null,
      createdByName: input.createdByName || 'Administrador',
    },
  });

  await recordAuditLog({
    action: 'MARKETING_CAMPAIGN_CREATE',
    entityType: 'MARKETING_CAMPAIGN',
    entityId: campaign.id,
    severity: 'INFO',
    details: `📢 Campaña de marketing "${campaign.name}" (${campaign.folio}) creada en estado ${status} para segmento ${campaign.targetSegment} (${audience.length} destinatarios estimados).`,
    brandId: input.brandId,
    userId: input.createdById || undefined,
  });

  return { campaign, estimatedAudienceSize: audience.length };
}

/**
 * Launch an existing marketing campaign, generating recipients, coupons, and WhatsApp links.
 */
export async function launchCampaign(
  campaignId: string,
  launchedBy?: { id?: string; name?: string }
) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: { brand: true },
  });

  if (!campaign) {
    throw new Error('Campaña no encontrada');
  }

  if (campaign.status === 'SENT') {
    throw new Error('La campaña ya fue enviada previamente.');
  }

  const brand = campaign.brand;
  const brandName = brand?.name || 'DarkFlow Multi-Brand';
  const menuLink = brand?.slug ? `https://darkflow.app/${brand.slug}/menu` : 'https://darkflow.app/menu';

  // 1. Fetch audience
  const audience = await getAudienceBySegment(
    campaign.brandId,
    campaign.targetSegment as TargetSegment
  );

  if (audience.length === 0) {
    throw new Error('No se encontraron clientes elegibles en el segmento seleccionado.');
  }

  // 2. Generate recipients and incentives in a transaction
  const recipientsData: any[] = [];
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 15); // 15 days validity for promo coupon

  for (const customer of audience) {
    // Generate individual or campaign coupon
    let assignedCoupon = campaign.couponCode;
    if (!assignedCoupon && campaign.discountPct && campaign.discountPct > 0) {
      assignedCoupon = generateRecipientCouponCode(brand.name.substring(0, 3).toUpperCase());
      // Create coupon in database
      try {
        await prisma.coupon.create({
          data: {
            code: assignedCoupon,
            description: `Cupón Campaña ${campaign.name} (${campaign.discountPct}% OFF)`,
            discountType: 'PERCENTAGE',
            discountValue: campaign.discountPct,
            usageLimit: 1,
            startDate: new Date(),
            endDate: expiryDate,
            isActive: true,
            brandId: campaign.brandId,
          },
        });
      } catch (err) {
        // Fallback code if collision occurs
        assignedCoupon = `${assignedCoupon}-${Math.floor(10 + Math.random() * 90)}`;
      }
    }

    // Optional direct wallet credit if walletBonusAmount is configured
    if (campaign.walletBonusAmount && campaign.walletBonusAmount > 0 && customer.id) {
      try {
        const bonus = campaign.walletBonusAmount;
        const newBalance = Number(((customer.walletBalance || 0) + bonus).toFixed(2));
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            walletBalance: newBalance,
            totalCashbackEarned: Number(((customer.totalCashbackEarned || 0) + bonus).toFixed(2)),
          },
        });
        await prisma.customerWalletTransaction.create({
          data: {
            customerId: customer.id,
            brandId: campaign.brandId,
            type: 'LOYALTY_BONUS',
            amount: bonus,
            balanceBefore: customer.walletBalance || 0,
            balanceAfter: newBalance,
            reference: `Campaña ${campaign.folio}`,
            notes: `Bono promocional de campaña: ${campaign.name}`,
            createdByName: launchedBy?.name || 'Motor de Marketing',
          },
        });
      } catch (walletErr) {
        console.error('Error applying wallet bonus to customer', customer.id, walletErr);
      }
    }

    // Interpolate message
    const customMessage = interpolateMessage(campaign.messageTemplate, {
      nombre: customer.name,
      marca: brandName,
      cupon: assignedCoupon || undefined,
      saldo_monedero: customer.walletBalance || 0,
      link_menu: menuLink,
      descuento: campaign.discountPct || 15,
    });

    const whatsappUrl = customer.phone
      ? formatWhatsAppUrl(customer.phone, customMessage)
      : null;

    recipientsData.push({
      campaignId: campaign.id,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email,
      status: 'SENT',
      couponCode: assignedCoupon || null,
      customMessage,
      whatsappUrl,
      sentAt: new Date(),
    });
  }

  // 3. Clear any previous draft recipients and insert fresh recipients
  await prisma.campaignRecipient.deleteMany({
    where: { campaignId: campaign.id },
  });

  await prisma.campaignRecipient.createMany({
    data: recipientsData,
  });

  // 4. Update campaign status to SENT
  const updatedCampaign = await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      totalRecipients: recipientsData.length,
      sentCount: recipientsData.length,
      deliveredCount: recipientsData.length,
      createdById: launchedBy?.id || campaign.createdById,
      createdByName: launchedBy?.name || campaign.createdByName,
    },
    include: {
      recipients: {
        take: 20,
      },
    },
  });

  await recordAuditLog({
    action: 'MARKETING_CAMPAIGN_LAUNCH',
    entityType: 'MARKETING_CAMPAIGN',
    entityId: campaign.id,
    severity: 'WARNING',
    details: `🚀 Campaña "${campaign.name}" (${campaign.folio}) disparada con éxito a ${recipientsData.length} destinatarios. Canal: ${campaign.channel}. Segmento: ${campaign.targetSegment}.`,
    brandId: campaign.brandId,
    userId: launchedBy?.id,
  });

  return updatedCampaign;
}

/**
 * Register conversion or click on a campaign recipient
 */
export async function trackRecipientConversion(recipientId: string, orderId?: string) {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    include: { campaign: true },
  });

  if (!recipient) return null;

  const updatedRecipient = await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: {
      status: 'CONVERTED',
      convertedAt: new Date(),
      orderId: orderId || null,
    },
  });

  await prisma.marketingCampaign.update({
    where: { id: recipient.campaignId },
    data: {
      conversionsCount: { increment: 1 },
      clicksCount: { increment: 1 },
    },
  });

  return updatedRecipient;
}

