import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LOYALTY_TIERS, LoyaltyTierId } from '@/lib/loyaltyTiers';
import { generateCustomerWalletQrCode, getCashbackRateByTier } from '@/lib/wallet';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || searchParams.get('q');

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Código QR o teléfono requerido' }, { status: 400 });
    }

    const cleaned = code.trim();

    // Search by walletQrCode, phone, or id
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { walletQrCode: cleaned },
          { phone: cleaned },
          { id: cleaned },
        ],
      },
      include: {
        orders: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, total: true, createdAt: true, status: true },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ 
        found: false, 
        error: `No se encontró ningún cliente con el código o teléfono: "${cleaned}"` 
      }, { status: 404 });
    }

    // Auto-generate QR if not present
    if (!customer.walletQrCode) {
      const newQr = generateCustomerWalletQrCode(customer.id);
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { walletQrCode: newQr },
        include: {
          orders: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: { id: true, orderNumber: true, total: true, createdAt: true, status: true },
          },
        },
      });
    }

    const tierId = (customer.tier as LoyaltyTierId) || 'BRONZE';
    const tierConfig = LOYALTY_TIERS[tierId] || LOYALTY_TIERS.BRONZE;
    const effectiveCashbackRate = customer.cashbackRatePct ?? getCashbackRateByTier(customer.tier);

    return NextResponse.json({
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        tier: customer.tier,
        walletBalance: customer.walletBalance,
        walletQrCode: customer.walletQrCode,
        cashbackRatePct: effectiveCashbackRate,
        loyaltyPoints: customer.loyaltyPoints,
        tierDiscountPct: customer.tierDiscountPct,
        totalSpent: customer.totalSpent,
        totalOrders: customer.totalOrders,
        tierConfig,
        recentOrders: customer.orders,
      },
    });
  } catch (error: any) {
    console.error('Error in customer QR lookup:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
