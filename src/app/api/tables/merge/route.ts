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
      return NextResponse.json({ error: 'No se puede fusionar una mesa consigo misma' }, { status: 400 });
    }

    const [sourceTable, targetTable] = await Promise.all([
      prisma.table.findUnique({
        where: { id: sourceTableId },
        include: {
          orders: {
            where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] } },
            include: { items: { include: { product: true } } },
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
            include: { items: { include: { product: true } } },
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

    const sourceOrder = sourceTable.orders[0];
    const targetOrder = targetTable.orders[0];

    if (!sourceOrder) {
      return NextResponse.json({ error: `La mesa #${sourceTable.number} no tiene comanda activa para fusionar` }, { status: 400 });
    }

    if (!targetOrder) {
      return NextResponse.json({ error: `La mesa #${targetTable.number} no tiene comanda activa. Puedes usar 'Transferir' en su lugar.` }, { status: 400 });
    }

    // Move all items from sourceOrder to targetOrder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionOps: any[] = [];

    for (const item of sourceOrder.items) {
      transactionOps.push(
        prisma.orderItem.create({
          data: {
            orderId: targetOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes ? `${item.notes} (Fusionado de Mesa #${sourceTable.number})` : `(Fusionado de Mesa #${sourceTable.number})`,
          },
        })
      );
    }

    // Cancel sourceOrder with note
    transactionOps.push(
      prisma.order.update({
        where: { id: sourceOrder.id },
        data: {
          status: 'CANCELLED',
          notes: `${sourceOrder.notes ? sourceOrder.notes + ' | ' : ''}Cuenta fusionada en Mesa #${targetTable.number} (Orden ${targetOrder.orderNumber})`,
        },
      })
    );

    // Free sourceTable
    transactionOps.push(
      prisma.table.update({
        where: { id: sourceTable.id },
        data: { status: 'AVAILABLE' },
      })
    );

    await prisma.$transaction(transactionOps);

    // Recalculate targetOrder subtotal, tax, and total
    const updatedTargetItems = await prisma.orderItem.findMany({
      where: { orderId: targetOrder.id },
    });

    const newSubtotal = updatedTargetItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const newTax = parseFloat((newSubtotal * 0.16).toFixed(2));
    const newTotal = parseFloat((newSubtotal + newTax).toFixed(2));

    const finalTargetOrder = await prisma.order.update({
      where: { id: targetOrder.id },
      data: {
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal,
        diners: (targetOrder.diners || 1) + (sourceOrder.diners || 1),
      },
      include: {
        items: { include: { product: true } },
        table: true,
      },
    });

    // Emit reactive event
    orderEvents.emit('order_event', {
      action: 'UPDATED',
      orderId: finalTargetOrder.id,
      brandId: session.activeBrandId,
      tableId: targetTable.id,
      orderNumber: finalTargetOrder.orderNumber,
      message: `Mesa #${sourceTable.number} fusionada en Mesa #${targetTable.number}`,
    });

    await recordAuditLog({
      action: 'TABLE_MERGED',
      entityType: 'TABLE',
      entityId: targetTable.id,
      details: {
        sourceNumber: sourceTable.number,
        targetNumber: targetTable.number,
        sourceOrderId: sourceOrder.id,
        targetOrderId: finalTargetOrder.id,
        mergedItemsCount: sourceOrder.items.length,
        newTotal: finalTargetOrder.total,
      },
      severity: 'INFO',
      brandId: session.activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Mesa #${sourceTable.number} fusionada con éxito en Mesa #${targetTable.number}`,
      order: finalTargetOrder,
    });
  } catch (error: unknown) {
    console.error('Error merging tables:', error);
    return NextResponse.json({ error: 'Error interno al fusionar mesas' }, { status: 500 });
  }
}
