import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Find active (open) session
    const activeSession = await prisma.cashSession.findFirst({
      where: {
        brandId: session.activeBrandId,
        status: 'OPEN',
      },
      include: {
        user: true,
        movements: {
          orderBy: { createdAt: 'desc' },
        },
        cuts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Find past closed sessions
    const pastSessions = await prisma.cashSession.findMany({
      where: {
        brandId: session.activeBrandId,
        status: 'CLOSED',
      },
      include: {
        user: true,
        cuts: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { closedAt: 'desc' },
      take: 10,
    });

    // Find recent cuts for brand
    const recentCuts = await prisma.cashCut.findMany({
      where: {
        cashSession: { brandId: session.activeBrandId },
      },
      include: {
        cashSession: {
          select: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { cutAt: 'desc' },
      take: 20,
    });

    // Calculate currently aggregated sales for the active session if open
    let activeAggregates = null;
    if (activeSession) {
      const orders = await prisma.order.findMany({
        where: {
          brandId: session.activeBrandId,
          createdAt: {
            gte: activeSession.openedAt,
          },
        },
      });

      const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
      const canceledOrders = orders.filter((o) => o.status === 'CANCELLED');

      let cashSales = 0;
      let cardSales = 0;
      let appsSales = 0;
      let giftCardSales = 0;
      let transfersSales = 0;
      let tipsCash = 0;
      let tipsCard = 0;
      let discountsTotal = 0;

      completedOrders.forEach((order) => {
        const tipVal = order.tip || 0;
        discountsTotal += (order.discountAmount || 0);

        if (order.source === 'UBER_EATS' || order.source === 'RAPPI' || order.source === 'DIDI_FOOD') {
          appsSales += order.total;
        } else if (order.paymentMethod === 'GIFT_CARD' || order.paymentMethod === 'MONEDERO') {
          giftCardSales += order.total;
        } else if (order.paymentMethod === 'TRANSFERENCIA') {
          transfersSales += order.total;
        } else if (order.paymentMethod === 'CASH') {
          cashSales += order.total;
          tipsCash += tipVal;
        } else if (order.paymentMethod === 'TERMINAL' || order.paymentMethod === 'CARD' || order.paymentMethod === 'STRIPE' || order.paymentMethod === 'MERCADOPAGO') {
          cardSales += order.total;
          tipsCard += tipVal;
        } else if (order.source === 'WEB') {
          cardSales += order.total;
          tipsCard += tipVal;
        } else {
          cashSales += order.total;
          tipsCash += tipVal;
        }
      });

      const tipsTotal = parseFloat((tipsCash + tipsCard).toFixed(2));
      const tipDistribution = {
        waiters: parseFloat((tipsTotal * 0.70).toFixed(2)),
        kitchen: parseFloat((tipsTotal * 0.20).toFixed(2)),
        bar: parseFloat((tipsTotal * 0.10).toFixed(2)),
      };

      const cashInTotal = activeSession.movements.filter((m) => m.type === 'IN').reduce((acc, m) => acc + m.amount, 0);
      const cashOutTotal = activeSession.movements.filter((m) => m.type === 'OUT').reduce((acc, m) => acc + m.amount, 0);

      const expectedCash = parseFloat((activeSession.openingBalance + cashSales + cashInTotal - cashOutTotal).toFixed(2));
      const totalSales = parseFloat((cashSales + cardSales + appsSales + giftCardSales + transfersSales).toFixed(2));

      activeAggregates = {
        cashSales: parseFloat(cashSales.toFixed(2)),
        cardSales: parseFloat(cardSales.toFixed(2)),
        appsSales: parseFloat(appsSales.toFixed(2)),
        giftCardSales: parseFloat(giftCardSales.toFixed(2)),
        transfersSales: parseFloat(transfersSales.toFixed(2)),
        totalSales,
        cashInTotal: parseFloat(cashInTotal.toFixed(2)),
        cashOutTotal: parseFloat(cashOutTotal.toFixed(2)),
        expectedCash,
        expectedBalance: expectedCash,
        ordersCount: completedOrders.length,
        discountsTotal: parseFloat(discountsTotal.toFixed(2)),
        canceledOrdersCount: canceledOrders.length,
        canceledAmount: parseFloat(canceledOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)),
        tipsCash: parseFloat(tipsCash.toFixed(2)),
        tipsCard: parseFloat(tipsCard.toFixed(2)),
        tipsTotal,
        tipDistribution,
      };
    }

    return NextResponse.json({ activeSession, activeAggregates, pastSessions, recentCuts });
  } catch (error: unknown) {
    console.error('Error fetching cash sessions:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { action, openingBalance, actualBalance, notes } = await req.json();

    if (action === 'open') {
      if (openingBalance === undefined || isNaN(parseFloat(openingBalance))) {
        return NextResponse.json({ error: 'Monto de apertura inválido' }, { status: 400 });
      }

      // Check if session already open
      const existing = await prisma.cashSession.findFirst({
        where: {
          brandId: activeBrandId,
          status: 'OPEN',
        },
      });

      if (existing) {
        return NextResponse.json({ error: 'Ya existe un turno abierto' }, { status: 400 });
      }

      const newSession = await prisma.cashSession.create({
        data: {
          brandId: activeBrandId,
          userId: session.userId,
          openingBalance: parseFloat(openingBalance),
          status: 'OPEN',
        },
      });

      await recordAuditLog({
        action: 'CASH_SESSION_OPENED',
        entityType: 'CASH_SESSION',
        entityId: newSession.id,
        details: { openingBalance: newSession.openingBalance },
        severity: 'INFO',
        brandId: activeBrandId,
        userId: session.userId,
        req,
      });

      return NextResponse.json({ success: true, session: newSession });
    }

    if (action === 'close') {
      if (actualBalance === undefined || isNaN(parseFloat(actualBalance))) {
        return NextResponse.json({ error: 'Monto de cierre inválido' }, { status: 400 });
      }

      // Find active session
      const activeSession = await prisma.cashSession.findFirst({
        where: {
          brandId: session.activeBrandId,
          status: 'OPEN',
        },
      });

      if (!activeSession) {
        return NextResponse.json({ error: 'No hay turno abierto para cerrar' }, { status: 400 });
      }

      // Fetch completed orders during session timeframe
      const orders = await prisma.order.findMany({
        where: {
          brandId: session.activeBrandId,
          createdAt: {
            gte: activeSession.openedAt,
          },
          status: 'DELIVERED',
        },
      });

      let cashSales = 0;
      let cardSales = 0;
      let appsSales = 0;
      let tipsCash = 0;
      let tipsCard = 0;

      orders.forEach((order) => {
        const tipVal = order.tip || 0;
        if (order.source === 'UBER_EATS' || order.source === 'RAPPI' || order.source === 'DIDI_FOOD') {
          appsSales += order.total;
        } else if (order.paymentMethod === 'CASH') {
          cashSales += order.total;
          tipsCash += tipVal;
        } else if (order.paymentMethod === 'TERMINAL' || order.paymentMethod === 'STRIPE' || order.paymentMethod === 'MERCADOPAGO') {
          cardSales += order.total;
          tipsCard += tipVal;
        } else if (order.source === 'WEB') {
          cardSales += order.total;
          tipsCard += tipVal;
        } else {
          cashSales += order.total;
          tipsCash += tipVal;
        }
      });

      const tipsTotal = parseFloat((tipsCash + tipsCard).toFixed(2));
      const parsedActual = parseFloat(actualBalance);
      const expectedBalance = parseFloat((activeSession.openingBalance + cashSales).toFixed(2));
      const discrepancy = Math.abs(parsedActual - expectedBalance);

      const updatedSession = await prisma.cashSession.update({
        where: { id: activeSession.id },
        data: {
          closedAt: new Date(),
          closingBalance: parsedActual,
          expectedBalance,
          actualBalance: parsedActual,
          cashSales: parseFloat(cashSales.toFixed(2)),
          cardSales: parseFloat(cardSales.toFixed(2)),
          appsSales: parseFloat(appsSales.toFixed(2)),
          tipsTotal,
          tipsCash: parseFloat(tipsCash.toFixed(2)),
          tipsCard: parseFloat(tipsCard.toFixed(2)),
          status: 'CLOSED',
          notes: notes || null,
        },
      });

      await recordAuditLog({
        action: 'CASH_SESSION_CLOSED',
        entityType: 'CASH_SESSION',
        entityId: updatedSession.id,
        details: {
          expectedBalance,
          actualBalance: parsedActual,
          difference: parseFloat((parsedActual - expectedBalance).toFixed(2)),
          cashSales,
          cardSales,
          appsSales,
          notes,
        },
        severity: discrepancy > 0.5 ? 'CRITICAL' : 'INFO',
        brandId: activeBrandId,
        userId: session.userId,
        req,
      });

      return NextResponse.json({ success: true, session: updatedSession });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error modifying cash session:', error);
    return NextResponse.json({ error: 'Error al procesar turno de caja' }, { status: 500 });
  }
}
