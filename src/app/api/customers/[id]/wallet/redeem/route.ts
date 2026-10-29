import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redeemCustomerWallet } from '@/lib/wallet';

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

    const body = await req.json();
    const { orderId, amount } = body;

    const numAmount = parseFloat(amount);
    if (!orderId || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Monto a redimir u orden no válidos' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, total: true, status: true, brandId: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 });
    }

    const result = await redeemCustomerWallet({
      customerId: id,
      brandId: session.activeBrandId as string,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountToRedeem: numAmount,
      userId: session.userId,
      userName: session.name,
    });

    return NextResponse.json({
      success: true,
      message: `Se aplicaron $${result.amountRedeemed.toFixed(2)} MXN del monedero a la comanda #${order.orderNumber}`,
      amountRedeemed: result.amountRedeemed,
      balanceAfter: result.balanceAfter,
      transaction: result.transaction,
    });
  } catch (error: any) {
    console.error('Error redeeming customer wallet:', error);
    return NextResponse.json({ error: error.message || 'Error al canjear saldo de monedero' }, { status: 500 });
  }
}
