import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export type WalletTransactionType = 
  | 'EARNED_CASHBACK' 
  | 'REDEEMED_PAYMENT' 
  | 'MANUAL_RECHARGE' 
  | 'REFUND_ADJUSTMENT' 
  | 'PROMO_BONUS';

export interface WalletTransactionDTO {
  id: string;
  customerId: string;
  brandId?: string | null;
  orderId?: string | null;
  type: WalletTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

/**
 * Returns default cashback rate percentage based on loyalty tier
 */
export function getCashbackRateByTier(tier: string = 'BRONZE'): number {
  switch (tier.toUpperCase()) {
    case 'PLATINUM':
      return 12.0; // 12% cashback para miembros Platino
    case 'GOLD':
      return 8.0;  // 8% cashback para miembros Oro
    case 'SILVER':
      return 5.0;  // 5% cashback para miembros Plata
    case 'BRONZE':
    default:
      return 3.0;  // 3% cashback para miembros Bronce
  }
}

/**
 * Generates a unique, scannable customer QR code string
 */
export function generateCustomerWalletQrCode(customerId: string): string {
  const shortId = customerId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `DF-WAL-${shortId}-${randomSuffix}`;
}

/**
 * Calculates cashback amount for an order based on subtotal and customer tier
 */
export function calculateOrderCashback(
  eligibleSubtotal: number,
  tier: string = 'BRONZE',
  customRate?: number | null
): { ratePct: number; cashbackAmount: number } {
  const ratePct = customRate !== undefined && customRate !== null && customRate >= 0
    ? customRate
    : getCashbackRateByTier(tier);

  const rawCashback = (eligibleSubtotal * ratePct) / 100;
  const cashbackAmount = parseFloat(Math.max(0, rawCashback).toFixed(2));

  return { ratePct, cashbackAmount };
}

/**
 * Credits cashback to a customer's wallet upon order payment completion
 */
export async function creditOrderCashback(params: {
  customerId: string;
  brandId: string;
  orderId: string;
  orderNumber: string;
  eligibleSubtotal: number;
  userId?: string;
  userName?: string;
}) {
  const { customerId, brandId, orderId, orderNumber, eligibleSubtotal, userId, userName } = params;

  return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Cliente no encontrado para acreditar cashback');
    }

    const { ratePct, cashbackAmount } = calculateOrderCashback(
      eligibleSubtotal,
      customer.tier,
      customer.cashbackRatePct
    );

    if (cashbackAmount <= 0) {
      return null;
    }

    const balanceBefore = customer.walletBalance;
    const balanceAfter = parseFloat((balanceBefore + cashbackAmount).toFixed(2));

    // Update customer wallet balance
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId },
      data: {
        walletBalance: balanceAfter,
        totalCashbackEarned: parseFloat((customer.totalCashbackEarned + cashbackAmount).toFixed(2)),
        // Generate QR code if not present
        walletQrCode: customer.walletQrCode || generateCustomerWalletQrCode(customer.id),
      },
    });

    // Record wallet transaction
    const transaction = await tx.customerWalletTransaction.create({
      data: {
        customerId,
        brandId,
        orderId,
        type: 'EARNED_CASHBACK',
        amount: cashbackAmount,
        balanceBefore,
        balanceAfter,
        reference: `Comanda #${orderNumber} (${ratePct}% de $${eligibleSubtotal.toFixed(2)})`,
        notes: `Cashback acreditado automáticamente por compra (${customer.tier})`,
        createdById: userId || null,
        createdByName: userName || 'Sistema POS',
      },
    });

    // Update Order with cashback earned
    await tx.order.update({
      where: { id: orderId },
      data: {
        cashbackEarned: cashbackAmount,
      },
    });

    return {
      transaction,
      cashbackAmount,
      ratePct,
      balanceAfter,
    };
  });
}

/**
 * Redeems balance from customer's wallet to pay (partially or totally) an order
 */
export async function redeemCustomerWallet(params: {
  customerId: string;
  brandId: string;
  orderId: string;
  orderNumber: string;
  amountToRedeem: number;
  userId?: string;
  userName?: string;
}) {
  const { customerId, brandId, orderId, orderNumber, amountToRedeem, userId, userName } = params;

  if (amountToRedeem <= 0) {
    throw new Error('El monto a redimir debe ser mayor a 0');
  }

  return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Cliente no encontrado');
    }

    if (customer.walletBalance < amountToRedeem) {
      throw new Error(
        `Saldo insuficiente en monedero. Saldo actual: $${customer.walletBalance.toFixed(2)} MXN, solicitado: $${amountToRedeem.toFixed(2)} MXN`
      );
    }

    const balanceBefore = customer.walletBalance;
    const balanceAfter = parseFloat((balanceBefore - amountToRedeem).toFixed(2));

    // Update customer wallet balance
    await tx.customer.update({
      where: { id: customerId },
      data: {
        walletBalance: balanceAfter,
        totalCashbackSpent: parseFloat((customer.totalCashbackSpent + amountToRedeem).toFixed(2)),
      },
    });

    // Record transaction
    const transaction = await tx.customerWalletTransaction.create({
      data: {
        customerId,
        brandId,
        orderId,
        type: 'REDEEMED_PAYMENT',
        amount: amountToRedeem,
        balanceBefore,
        balanceAfter,
        reference: `Pago Comanda #${orderNumber}`,
        notes: `Canje de saldo en monedero digital`,
        createdById: userId || null,
        createdByName: userName || 'Cajero POS',
      },
    });

    // Update order with walletAmountPaid
    await tx.order.update({
      where: { id: orderId },
      data: {
        walletAmountPaid: {
          increment: amountToRedeem,
        },
      },
    });

    return {
      transaction,
      amountRedeemed: amountToRedeem,
      balanceAfter,
    };
  });
}

/**
 * Performs a manual recharge or balance adjustment by a supervisor
 */
export async function manualWalletRecharge(params: {
  customerId: string;
  brandId: string;
  amount: number;
  type?: 'MANUAL_RECHARGE' | 'PROMO_BONUS' | 'REFUND_ADJUSTMENT';
  reference?: string;
  notes?: string;
  userId: string;
  userName: string;
}) {
  const { customerId, brandId, amount, type = 'MANUAL_RECHARGE', reference, notes, userId, userName } = params;

  if (amount === 0) {
    throw new Error('El monto no puede ser cero');
  }

  return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Cliente no encontrado');
    }

    const balanceBefore = customer.walletBalance;
    const balanceAfter = parseFloat(Math.max(0, balanceBefore + amount).toFixed(2));

    // Update customer
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        walletBalance: balanceAfter,
        walletQrCode: customer.walletQrCode || generateCustomerWalletQrCode(customer.id),
        totalCashbackEarned: amount > 0 
          ? parseFloat((customer.totalCashbackEarned + amount).toFixed(2)) 
          : customer.totalCashbackEarned,
      },
    });

    // Transaction log
    const transaction = await tx.customerWalletTransaction.create({
      data: {
        customerId,
        brandId,
        type,
        amount: Math.abs(amount),
        balanceBefore,
        balanceAfter,
        reference: reference || `Ajuste manual de saldo (${amount > 0 ? '+' : ''}$${amount.toFixed(2)})`,
        notes: notes || 'Recarga o compensación gerencial de monedero',
        createdById: userId,
        createdByName: userName,
      },
    });

    await recordAuditLog({
      brandId,
      userId,
      action: 'CUSTOMER_WALLET_ADJUSTED',
      entityType: 'CustomerWalletTransaction',
      entityId: transaction.id,
      severity: 'INFO',
      details: {
        customerId: customer.id,
        customerName: customer.name,
        amount,
        type,
        balanceBefore,
        balanceAfter,
      },
    });

    return {
      transaction,
      balanceAfter,
      customer: updated,
    };
  });
}
