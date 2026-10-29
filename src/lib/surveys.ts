import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import {
  NPSCategory,
  CompensationType,
  CompensationStatus,
  POPULAR_SURVEY_TAGS,
} from './surveyConstants';

export type {
  NPSCategory,
  CompensationType,
  CompensationStatus,
};
export { POPULAR_SURVEY_TAGS };

/**
 * NPS, CSAT & Automatic Customer Recovery Engine (Phase 29 & Phase 51)
 * Calculates Net Promoter Score (NPS), CSAT, and executes instant compensations
 * via digital wallet credit or apology discount coupons for dissatisfied diners.
 */

export interface NPSStats {
  score: number; // -100 to +100
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
  csatPct: number; // % of 4-5 star ratings
  avgOverallRating: number;
  avgFoodRating: number;
  avgServiceRating: number;
  avgSpeedRating: number;
  avgCleanlinessRating: number;
  totalCompensationsAmount: number;
  totalCompensationsCount: number;
}

export interface CompensationResult {
  applied: boolean;
  type: CompensationType;
  amount: number;
  couponCode?: string | null;
  couponId?: string | null;
  walletTxId?: string | null;
  newWalletBalance?: number | null;
  message: string;
}

/**
 * Classifies an NPS score (0-10) into Promoter, Passive, or Detractor.
 */
export function classifyNPS(score: number): NPSCategory {
  if (score >= 9) return 'PROMOTER';
  if (score >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}

/**
 * Checks whether an incoming survey qualifies as an urgent manager recovery alert.
 */
export function isDetractorAlert(overallRating: number, npsScore: number): boolean {
  return overallRating <= 3 || npsScore <= 6;
}

/**
 * Generates an apology coupon code
 */
export function generateApologyCouponCode(): string {
  const hex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
  return `DISCULPA-${hex}`;
}

/**
 * Calculates aggregated NPS and rating breakdown across a set of surveys.
 */
export function calculateNPSSummary(
  surveys: Array<{
    overallRating: number;
    npsScore: number;
    foodRating?: number | null;
    serviceRating?: number | null;
    speedRating?: number | null;
    cleanlinessRating?: number | null;
    compensationAmount?: number | null;
    compensationType?: string | null;
  }>
): NPSStats {
  const total = surveys.length;
  if (total === 0) {
    return {
      score: 0,
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
      csatPct: 0,
      avgOverallRating: 0,
      avgFoodRating: 0,
      avgServiceRating: 0,
      avgSpeedRating: 0,
      avgCleanlinessRating: 0,
      totalCompensationsAmount: 0,
      totalCompensationsCount: 0,
    };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let csatPositiveCount = 0;

  let sumOverall = 0;
  let sumFood = 0;
  let countFood = 0;
  let sumService = 0;
  let countService = 0;
  let sumSpeed = 0;
  let countSpeed = 0;
  let sumClean = 0;
  let countClean = 0;

  let compAmountSum = 0;
  let compCount = 0;

  for (const s of surveys) {
    sumOverall += s.overallRating;

    if (s.overallRating >= 4) {
      csatPositiveCount++;
    }

    if (s.npsScore >= 9) promoters++;
    else if (s.npsScore >= 7) passives++;
    else detractors++;

    if (typeof s.foodRating === 'number' && s.foodRating > 0) {
      sumFood += s.foodRating;
      countFood++;
    }
    if (typeof s.serviceRating === 'number' && s.serviceRating > 0) {
      sumService += s.serviceRating;
      countService++;
    }
    if (typeof s.speedRating === 'number' && s.speedRating > 0) {
      sumSpeed += s.speedRating;
      countSpeed++;
    }
    if (typeof s.cleanlinessRating === 'number' && s.cleanlinessRating > 0) {
      sumClean += s.cleanlinessRating;
      countClean++;
    }

    if (s.compensationType && s.compensationType !== 'NONE') {
      compCount++;
      compAmountSum += s.compensationAmount || 0;
    }
  }

  const promoterPct = Math.round((promoters / total) * 100);
  const passivePct = Math.round((passives / total) * 100);
  const detractorPct = Math.round((detractors / total) * 100);
  const csatPct = Math.round((csatPositiveCount / total) * 100);
  const score = promoterPct - detractorPct; // Standard NPS formula: % Promoters - % Detractors

  return {
    score,
    total,
    promoters,
    passives,
    detractors,
    promoterPct,
    passivePct,
    detractorPct,
    csatPct,
    avgOverallRating: Number((sumOverall / total).toFixed(1)),
    avgFoodRating: countFood > 0 ? Number((sumFood / countFood).toFixed(1)) : 0,
    avgServiceRating: countService > 0 ? Number((sumService / countService).toFixed(1)) : 0,
    avgSpeedRating: countSpeed > 0 ? Number((sumSpeed / countSpeed).toFixed(1)) : 0,
    avgCleanlinessRating: countClean > 0 ? Number((sumClean / countClean).toFixed(1)) : 0,
    totalCompensationsAmount: Number(compAmountSum.toFixed(2)),
    totalCompensationsCount: compCount,
  };
}

/**
 * Executes automatic compensation for a dissatisfied diner.
 * If customer is identified with wallet balance -> credits wallet balance immediately.
 * Otherwise -> issues a unique single-use apology coupon valid for 30 days.
 */
export async function executeAutomaticCompensation(params: {
  brandId: string;
  orderId: string;
  orderNumber: string;
  overallRating: number;
  npsScore: number;
  customerId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
}): Promise<CompensationResult> {
  const {
    brandId,
    orderId,
    orderNumber,
    overallRating,
    npsScore,
    customerId,
    customerPhone,
    customerName,
  } = params;

  // 1. Fetch brand recovery policy
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!brand || !brand.autoCompensationEnabled) {
    return {
      applied: false,
      type: 'NONE',
      amount: 0,
      message: 'Compensación automática desactivada para esta marca.',
    };
  }

  // 2. Check if rating triggers compensation
  const qualifies = overallRating <= brand.autoCompRatingThreshold || npsScore <= 6;
  if (!qualifies) {
    return {
      applied: false,
      type: 'NONE',
      amount: 0,
      message: 'La calificación no califica para compensación automática.',
    };
  }

  // 3. Try to locate or associate existing customer for wallet credit
  let targetCustomer = null;
  if (customerId) {
    targetCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
  } else if (customerPhone) {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 8) {
      targetCustomer = await prisma.customer.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-8) },
          brandId,
        },
      });
    }
  }

  // Scenario A: Customer has a digital wallet account -> Credit Wallet directly
  if (targetCustomer) {
    const creditAmount = brand.autoCompWalletAmount || 50.0;

    const result = await prisma.$transaction(async (tx) => {
      const freshCustomer = await tx.customer.findUniqueOrThrow({
        where: { id: targetCustomer.id },
      });

      const balanceBefore = freshCustomer.walletBalance;
      const balanceAfter = Number((balanceBefore + creditAmount).toFixed(2));

      await tx.customer.update({
        where: { id: targetCustomer.id },
        data: {
          walletBalance: balanceAfter,
          totalCashbackEarned: Number((freshCustomer.totalCashbackEarned + creditAmount).toFixed(2)),
        },
      });

      const walletTx = await tx.customerWalletTransaction.create({
        data: {
          customerId: targetCustomer.id,
          brandId,
          orderId,
          type: 'REFUND_ADJUSTMENT',
          amount: creditAmount,
          balanceBefore,
          balanceAfter,
          reference: `Compensación Comanda #${orderNumber}`,
          notes: `Bonificación automática por satisfacción (${overallRating}★). Comensal: ${customerName || freshCustomer.name}`,
          createdByName: 'Sistema de Recuperación CSAT',
        },
      });

      return {
        walletTx,
        newBalance: balanceAfter,
      };
    });

    await recordAuditLog({
      action: 'CUSTOMER_COMPENSATION_WALLET',
      entityType: 'CUSTOMER_WALLET',
      entityId: targetCustomer.id,
      severity: 'WARNING',
      details: `💰 Compensación automática de $${creditAmount.toFixed(2)} MXN acreditada a ${targetCustomer.name} por mala experiencia en Comanda #${orderNumber} (${overallRating}★). Saldo final: $${result.newBalance.toFixed(2)} MXN`,
      brandId,
    });

    return {
      applied: true,
      type: 'WALLET_CREDIT',
      amount: creditAmount,
      walletTxId: result.walletTx.id,
      newWalletBalance: result.newBalance,
      message: `Hemos acreditado $${creditAmount.toFixed(2)} MXN a tu Monedero Digital para compensar tu experiencia. Tu nuevo saldo es $${result.newBalance.toFixed(2)} MXN.`,
    };
  }

  // Scenario B: Customer is not registered yet -> Issue a single-use Apology Coupon
  const discountPct = brand.autoCompCouponDiscount || 20.0;
  const couponCode = generateApologyCouponCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

  const createdCoupon = await prisma.coupon.create({
    data: {
      code: couponCode,
      description: `Cupón de disculpa por Comanda #${orderNumber} (${discountPct}% de descuento)`,
      discountType: 'PERCENTAGE',
      discountValue: discountPct,
      minOrderAmount: 0,
      usageLimit: 1,
      usedCount: 0,
      startDate: new Date(),
      endDate: expiresAt,
      isActive: true,
      brandId,
    },
  });

  await recordAuditLog({
    action: 'CUSTOMER_COMPENSATION_COUPON',
    entityType: 'COUPON',
    entityId: createdCoupon.id,
    severity: 'WARNING',
    details: `🎟️ Cupón de compensación ${couponCode} (${discountPct}%) generado para comensal ${customerName || 'Invitado'} por Comanda #${orderNumber} (${overallRating}★). Válido por 30 días.`,
    brandId,
  });

  return {
    applied: true,
    type: 'COUPON',
    amount: discountPct,
    couponCode: createdCoupon.code,
    couponId: createdCoupon.id,
    message: `Lamentamos sinceramente lo ocurrido. Te obsequiamos el cupón exclusivo ${couponCode} con ${discountPct}% de descuento en tu próxima visita.`,
  };
}
