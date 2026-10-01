import { prisma } from './db';

export interface GiftCardDTO {
  id: string;
  code: string;
  pin?: string | null;
  brandId: string;
  customerId?: string | null;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  } | null;
  initialBalance: number;
  balance: number;
  status: 'ACTIVE' | 'DEPLETED' | 'BLOCKED' | 'EXPIRED' | string;
  expiresAt?: string | Date | null;
  cardType: 'DIGITAL' | 'PHYSICAL' | 'VIP_WALLET' | string;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  transactions?: GiftCardTransactionDTO[];
}

export interface GiftCardTransactionDTO {
  id: string;
  giftCardId: string;
  type: 'RECHARGE' | 'DEBIT' | 'REFUND' | 'CASHBACK' | 'ADJUSTMENT' | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string | Date;
}

/**
 * Generate a unique, professional gift card code (e.g., GC-4892-9102)
 */
export function generateGiftCardCode(prefix = 'GC'): string {
  const seg1 = Math.floor(1000 + Math.random() * 9000);
  const seg2 = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${seg1}-${seg2}`;
}

/**
 * Validate gift card status and balance availability
 */
export function validateGiftCardForUse(card: {
  status: string;
  balance: number;
  expiresAt?: Date | string | null;
}): { valid: boolean; reason?: string } {
  if (card.status === 'BLOCKED') {
    return { valid: false, reason: 'Tarjeta de regalo o monedero bloqueado' };
  }
  if (card.status === 'DEPLETED' || card.balance <= 0) {
    return { valid: false, reason: 'La tarjeta no cuenta con saldo disponible' };
  }
  if (card.status === 'EXPIRED') {
    return { valid: false, reason: 'La tarjeta de regalo ha expirado' };
  }
  if (card.expiresAt) {
    const exp = new Date(card.expiresAt);
    if (new Date() > exp) {
      return { valid: false, reason: 'La tarjeta de regalo ha expirado por fecha' };
    }
  }
  return { valid: true };
}
