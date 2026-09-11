import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { sourceTableId, targetTableId } = body;

    if (!sourceTableId || !targetTableId) {
      return NextResponse.json({ error: 'Mesa origen y mesa destino son requeridas' }, { status: 400 });
    }

    if (sourceTableId === targetTableId) {
      return NextResponse.json({ error: 'La mesa origen y destino no pueden ser la misma' }, { status: 400 });
    }

    const [sourceTable, targetTable] = await Promise.all([
      prisma.table.findUnique({
        where: { id: sourceTableId },
        include: {
          orders: {
            where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.table.findUnique({
        where: { id: targetTableId },
        include: {
          orders: {
            where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    if (!sourceTable || sourceTable.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Mesa origen no encontrada' }, { status: 404 });
    }

    if (!targetTable || targetTable.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Mesa destino no encontrada' }, { status: 404 });
    }

    const activeOrder = sourceTable.orders[0];
    if (!activeOrder) {
      return NextResponse.json({ error: `La mesa #${sourceTable.number} no tiene comanda activa para transferir` }, { status: 400 });
    }

    if (targetTable.orders.length > 0) {
      return NextResponse.json({
        error: `La mesa destino #${targetTable.number} ya tiene una comanda activa. Utiliza 'Unir Mesas' si deseas fusionarlas.`,
      }, { status: 400 });
    }

    // Perform transfer in atomic transaction
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: activeOrder.id },
        data: { tableId: targetTable.id },
        include: {
          items: {
            include: { product: true },
          },
          table: true,
        },
      }),
      prisma.table.update({
        where: { id: sourceTable.id },
        data: { status: 'AVAILABLE' },
      }),
      prisma.table.update({
        where: { id: targetTable.id },
        data: { status: 'OCCUPIED' },
      }),
    ]);

    // Emit reactive event to KDS, POS, and Salon
    orderEvents.emit('order_event', {
      action: 'UPDATED',
      orderId: updatedOrder.id,
      brandId: session.activeBrandId,
      tableId: targetTable.id,
      orderNumber: updatedOrder.orderNumber,
      message: `Comanda transferida de Mesa #${sourceTable.number} a Mesa #${targetTable.number}`,
    });

    await recordAuditLog({
      action: 'TABLE_TRANSFERRED',
      entityType: 'TABLE',
      entityId: sourceTable.id,
      details: {
        sourceNumber: sourceTable.number,
        targetNumber: targetTable.number,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        total: updatedOrder.total,
      },
      severity: 'INFO',
      brandId: session.activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Comanda de Mesa #${sourceTable.number} transferida con éxito a Mesa #${targetTable.number}`,
      order: updatedOrder,
    });
  } catch (error: unknown) {
    console.error('Error transferring table order:', error);
    return NextResponse.json({ error: 'Error interno al transferir comanda' }, { status: 500 });
  }
}
