import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { orderEvents } from '@/lib/events';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { status, driverId } = await req.json();
    const { id } = await params;
    const orderId = id;

    // Load original order to verify existence and check current status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                recipeItems: {
                  include: {
                    ingredient: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Verify brand ownership
    if (order.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'No tienes acceso a este pedido' }, { status: 403 });
    }

    const updateData: Prisma.OrderUpdateInput = {};
    if (status) updateData.status = status;
    if (driverId !== undefined) {
      updateData.driver = driverId ? { connect: { id: driverId } } : { disconnect: true };
    }

    // Core requirement check: Deduct inventory stock if status is changing to DELIVERED
    const isTransitioningToDelivered = status === 'DELIVERED' && order.status !== 'DELIVERED';

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Deduct stock if transitioning to DELIVERED
      if (isTransitioningToDelivered) {
        for (const orderItem of order.items) {
          const product = orderItem.product;
          
          // Deduct stock for each ingredient in this product's recipe
          for (const recipeItem of product.recipeItems) {
            const deductionQty = recipeItem.quantity * orderItem.quantity;
            
            await tx.ingredient.update({
              where: { id: recipeItem.ingredientId },
              data: {
                stock: {
                  decrement: deductionQty,
                },
              },
            });
          }
        }
      }

      // 2. If this was a dine-in order and is DELIVERED or CANCELLED, release the table
      if (order.tableId && (status === 'DELIVERED' || status === 'CANCELLED')) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      // 3. Update order fields
      return await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          driver: true,
          table: true,
        },
      });
    });

    // Emit real-time order update event for KDS and dispatch
    orderEvents.emit('order_event', {
      action: status ? 'STATUS_CHANGED' : 'UPDATED',
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      brandId: updatedOrder.brandId,
      source: updatedOrder.source,
      customerName: updatedOrder.customerName,
      tableId: updatedOrder.tableId,
      timestamp: new Date().toISOString(),
      order: updatedOrder,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: unknown) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Error al actualizar el pedido' }, { status: 500 });
  }
}
