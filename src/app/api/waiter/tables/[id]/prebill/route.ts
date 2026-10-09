import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { id } = await params;
    const tableId = id;

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!table || table.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    const activeOrder = table.orders[0];
    if (!activeOrder) {
      return NextResponse.json({ error: 'La mesa no tiene una comanda activa' }, { status: 400 });
    }

    // Update table and order atomically
    await prisma.$transaction([
      prisma.table.update({
        where: { id: tableId },
        data: { status: 'PREBILL' },
      }),
      prisma.order.update({
        where: { id: activeOrder.id },
        data: {
          prebillPrintedAt: new Date(),
          prebillPrintedCount: { increment: 1 },
        },
      }),
    ]);

    // Emit event to cashier/pos
    orderEvents.emit('order_updated', {
      id: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      brandId: session.activeBrandId,
      tableNumber: table.number,
      action: 'PREBILL_REQUESTED',
    });

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'WAITER_PREBILL_REQUESTED',
      entityType: 'Order',
      entityId: activeOrder.id,
      details: {
        tableNumber: table.number,
        orderNumber: activeOrder.orderNumber,
        total: activeOrder.total,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Pre-cuenta de Mesa ${table.number} solicitada con éxito`,
    });
  } catch (error: unknown) {
    console.error('Error requesting prebill:', error);
    return NextResponse.json({ error: 'Error al solicitar pre-cuenta' }, { status: 500 });
  }
}
