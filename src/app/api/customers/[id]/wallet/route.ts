import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { 
  generateCustomerWalletQrCode, 
  manualWalletRecharge, 
  getCashbackRateByTier 
} from '@/lib/wallet';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Auto-generate QR code if customer doesn't have one yet
    if (!customer.walletQrCode) {
      const generatedQr = generateCustomerWalletQrCode(customer.id);
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { walletQrCode: generatedQr },
        include: { brand: { select: { id: true, name: true } } },
      });
    }

    // Fetch transactions
    const transactions = await prisma.customerWalletTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        order: { select: { orderNumber: true, total: true } },
      },
    });

    const defaultCashbackRate = getCashbackRateByTier(customer.tier);

    return NextResponse.json({
      wallet: {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        email: customer.email,
        tier: customer.tier,
        walletBalance: customer.walletBalance,
        walletQrCode: customer.walletQrCode,
        cashbackRatePct: customer.cashbackRatePct ?? defaultCashbackRate,
        defaultCashbackRate,
        totalCashbackEarned: customer.totalCashbackEarned,
        totalCashbackSpent: customer.totalCashbackSpent,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
      },
      transactions,
    });
  } catch (error: any) {
    console.error('Error fetching customer wallet:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Role check: Only Cashiers, Brand Admins or Super Admins can adjust balances
    if (session.role === 'KITCHEN' || session.role === 'DELIVERY') {
      return NextResponse.json({ error: 'Permisos insuficientes para modificar saldo de monedero' }, { status: 403 });
    }

    const body = await req.json();
    const { amount, type = 'MANUAL_RECHARGE', reference, notes } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      return NextResponse.json({ error: 'El monto ingresado no es válido' }, { status: 400 });
    }

    const result = await manualWalletRecharge({
      customerId: id,
      brandId: session.activeBrandId as string,
      amount: numAmount,
      type: type as any,
      reference,
      notes,
      userId: session.userId,
      userName: session.name,
    });

    return NextResponse.json({
      success: true,
      message: `Saldo actualizado exitosamente. Nuevo balance: $${result.balanceAfter.toFixed(2)} MXN`,
      transaction: result.transaction,
      balanceAfter: result.balanceAfter,
    });
  } catch (error: any) {
    console.error('Error recharging customer wallet:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar saldo' }, { status: 500 });
  }
}
