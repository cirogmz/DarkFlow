import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const zoneFilter = searchParams.get('zone');

    const where: any = {
      brandId: session.activeBrandId,
    };
    if (zoneFilter && zoneFilter !== 'TODAS') {
      where.zone = zoneFilter;
    }

    const tables = await prisma.table.findMany({
      where,
      include: {
        assignedWaiter: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          where: {
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                  },
                },
              },
            },
            waiter: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reservations: {
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
            reservationDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
          orderBy: { reservationDate: 'asc' },
          take: 1,
        },
      },
      orderBy: [
        { zone: 'asc' },
        { number: 'asc' },
      ],
    });

    // Format tables with operational metrics for the waiter
    const enrichedTables = tables.map((t) => {
      const activeOrder = t.orders[0] || null;
      let elapsedMinutes = 0;
      let pendingKitchenCount = 0;
      let cookingKitchenCount = 0;
      let readyKitchenCount = 0;
      let servedKitchenCount = 0;

      if (activeOrder) {
        elapsedMinutes = Math.floor(
          (Date.now() - new Date(activeOrder.createdAt).getTime()) / (1000 * 60)
        );
        for (const itm of activeOrder.items) {
          if (itm.status === 'PENDING') pendingKitchenCount += itm.quantity;
          else if (itm.status === 'COOKING') cookingKitchenCount += itm.quantity;
          else if (itm.status === 'DONE') readyKitchenCount += itm.quantity;
          else if (itm.status === 'SERVED') servedKitchenCount += itm.quantity;
        }
      }

      return {
        id: t.id,
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        status: t.status, // AVAILABLE, OCCUPIED, PREBILL, RESERVED
        zone: t.zone,
        assignedWaiter: t.assignedWaiter || activeOrder?.waiter || null,
        activeOrder: activeOrder
          ? {
              id: activeOrder.id,
              orderNumber: activeOrder.orderNumber,
              diners: activeOrder.diners || 1,
              status: activeOrder.status,
              currentStage: activeOrder.currentStage || 'STARTER',
              total: activeOrder.total,
              subtotal: activeOrder.subtotal,
              tax: activeOrder.tax,
              createdAt: activeOrder.createdAt,
              elapsedMinutes,
              prebillPrintedAt: activeOrder.prebillPrintedAt,
              prebillPrintedCount: activeOrder.prebillPrintedCount,
              expoStatus: activeOrder.expoStatus,
              expoNotifiedAt: activeOrder.expoNotifiedAt,
              itemsCount: activeOrder.items.length,
              kitchenStats: {
                pending: pendingKitchenCount,
                cooking: cookingKitchenCount,
                ready: readyKitchenCount,
                served: servedKitchenCount,
              },
              items: activeOrder.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.product.name,
                quantity: i.quantity,
                price: i.price,
                status: i.status,
                serviceStage: i.serviceStage,
                notes: i.notes,
                modifiers: i.modifiers,
                startedAt: i.startedAt,
                finishedAt: i.finishedAt,
                servedAt: i.servedAt,
              })),
            }
          : null,
        reservation: t.reservations[0]
          ? {
              customerName: t.reservations[0].customerName,
              reservationDate: t.reservations[0].reservationDate,
              partySize: t.reservations[0].diners,
            }
          : null,
      };
    });

    // Extract unique zones
    const zones = Array.from(new Set(tables.map((t) => t.zone || 'Salón')));

    return NextResponse.json({
      success: true,
      tables: enrichedTables,
      zones,
    });
  } catch (error: unknown) {
    console.error('Error fetching waiter tables:', error);
    return NextResponse.json({ error: 'Error interno al consultar mesas' }, { status: 500 });
  }
}
