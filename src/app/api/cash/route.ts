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

    // Find active (open) session
    const activeSession = await prisma.cashSession.findFirst({
      where: {
        brandId: session.activeBrandId,
        status: 'OPEN',
      },
      include: {
        user: true,
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
      },
      orderBy: { closedAt: 'desc' },
      take: 10,
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
          status: 'DELIVERED', // Count completed orders
        },
      });

      let cashSales = 0;
      let cardSales = 0;
      let appsSales = 0;

      orders.forEach((order) => {
        if (order.source === 'UBER_EATS' || order.source === 'RAPPI') {
          appsSales += order.total;
        } else if (order.source === 'WEB') {
          cardSales += order.total; // WEB default to Card online payment
        } else {
          cashSales += order.total; // PHONE default to Cash on delivery
        }
      });

      activeAggregates = {
        cashSales: parseFloat(cashSales.toFixed(2)),
        cardSales: parseFloat(cardSales.toFixed(2)),
        appsSales: parseFloat(appsSales.toFixed(2)),
        totalSales: parseFloat((cashSales + cardSales + appsSales).toFixed(2)),
        expectedBalance: parseFloat((activeSession.openingBalance + cashSales).toFixed(2)),
      };
    }

    return NextResponse.json({ activeSession, activeAggregates, pastSessions });
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

      orders.forEach((order) => {
        if (order.source === 'UBER_EATS' || order.source === 'RAPPI') {
          appsSales += order.total;
        } else if (order.source === 'WEB') {
          cardSales += order.total;
        } else {
          cashSales += order.total;
        }
      });

      const parsedActual = parseFloat(actualBalance);
      const expectedBalance = parseFloat((activeSession.openingBalance + cashSales).toFixed(2));

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
          status: 'CLOSED',
          notes: notes || null,
        },
      });

      return NextResponse.json({ success: true, session: updatedSession });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error modifying cash session:', error);
    return NextResponse.json({ error: 'Error al procesar turno de caja' }, { status: 500 });
  }
}
