import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json({ error: 'Se requiere driverId' }, { status: 400 });
    }

    // Verify driver exists
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      include: {
        deliveryProfile: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 });
    }

    // Fetch delivered and unsettled orders for this driver in this brand
    const orders = await prisma.order.findMany({
      where: {
        driverId,
        brandId: session.activeBrandId,
        status: 'DELIVERED',
        driverSettled: false,
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        customer: true,
      },
      orderBy: { deliveredAt: 'asc' },
    });

    // Check for open cash session
    const openCashSession = await prisma.cashSession.findFirst({
      where: {
        brandId: session.activeBrandId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });

    const isCashPayment = (method?: string | null) => {
      if (!method) return true; // Default COD delivery is cash
      const m = method.toUpperCase();
      return m.includes('CASH') || m.includes('EFECTIVO');
    };

    let totalCashExpected = 0;
    let totalCardExpected = 0;
    let totalTips = 0;
    let totalDeliveryFees = 0;

    const classifiedOrders = orders.map((o) => {
      const isCash = isCashPayment(o.paymentMethod);
      if (isCash) {
        totalCashExpected += o.total;
      } else {
        totalCardExpected += o.total;
      }
      totalTips += (o.tip || 0);
      totalDeliveryFees += (o.deliveryFee || 0);

      return {
        ...o,
        isCash,
      };
    });

    const commissionRate = driver.deliveryProfile?.commissionPerOrder || 0;
    const totalCommissions = commissionRate * orders.length;
    const activeCashFloat = driver.deliveryProfile?.activeCashFloat || 0;

    return NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        deliveryProfile: driver.deliveryProfile,
      },
      openCashSession: openCashSession ? { id: openCashSession.id, openedAt: openCashSession.openedAt } : null,
      summary: {
        totalOrders: orders.length,
        cashOrdersCount: classifiedOrders.filter((o) => o.isCash).length,
        cardOrdersCount: classifiedOrders.filter((o) => !o.isCash).length,
        totalCashExpected,
        totalCardExpected,
        totalTips,
        totalDeliveryFees,
        totalCommissions,
        activeCashFloat,
        // Suggested cash to cashier = Total cash collected (+ active cash float if returning float)
        suggestedCashToCashier: totalCashExpected,
      },
      orders: classifiedOrders,
    });
  } catch (error: unknown) {
    console.error('Error fetching driver pending settlement:', error);
    return NextResponse.json({ error: 'Error al consultar liquidación pendiente' }, { status: 500 });
  }
}
