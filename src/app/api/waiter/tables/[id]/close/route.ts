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
    const { paymentMethod = 'CASH', tip = 0, amountPaid } = await req.json();

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    recipeItems: true,
                  },
                },
              },
            },
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

    const parsedTip = typeof tip === 'number' ? tip : parseFloat(String(tip || '0'));
    const finalTotal = activeOrder.total + parsedTip;
    const finalPaid = amountPaid ? parseFloat(String(amountPaid)) : finalTotal;
    const change = Math.max(0, finalPaid - finalTotal);

    await prisma.$transaction(async (tx) => {
      // 1. Close order
      await tx.order.update({
        where: { id: activeOrder.id },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          paymentMethod,
          tip: parsedTip,
          paidAmount: finalPaid,
          changeAmount: change,
          paidAt: new Date(),
        },
      });

      // 2. Free table
      await tx.table.update({
        where: { id: tableId },
        data: {
          status: 'AVAILABLE',
          assignedWaiterId: null,
        },
      });

      // 3. Deduct stock for all items in order
      for (const orderItem of activeOrder.items) {
        for (const recipeItem of orderItem.product.recipeItems) {
          const deductionQty = recipeItem.quantity * orderItem.quantity;
          await tx.ingredient.update({
            where: { id: recipeItem.ingredientId },
            data: {
              stock: { decrement: deductionQty },
            },
          });
        }
      }
    });

    // Emit event
    orderEvents.emit('order_updated', {
      id: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      brandId: session.activeBrandId,
      tableNumber: table.number,
      status: 'COMPLETED',
      action: 'TABLE_CLOSED',
    });

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'WAITER_TABLE_CHECKOUT',
      entityType: 'Order',
      entityId: activeOrder.id,
      details: {
        tableNumber: table.number,
        orderNumber: activeOrder.orderNumber,
        total: activeOrder.total,
        tip: parsedTip,
        paymentMethod,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Mesa ${table.number} cobrada y liberada con éxito`,
      change,
    });
  } catch (error: unknown) {
    console.error('Error closing table in waiter pad:', error);
    return NextResponse.json({ error: 'Error al cobrar y cerrar mesa' }, { status: 500 });
  }
}
