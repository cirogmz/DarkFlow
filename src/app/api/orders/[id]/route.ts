import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';
import { createSecurityIncident } from '@/lib/lossPrevention';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
        customer: true,
        brand: true,
        paymentTransactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (order.brandId !== session.activeBrandId && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    console.error('Error fetching order by ID:', error);
    return NextResponse.json({ error: 'Error interno al consultar comanda' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { status, driverId, currentStage, itemUpdates, markPrebillPrinted } = await req.json();
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
    if (status) {
      updateData.status = status;
      if (status === 'PREPARING' && !order.cookingStartedAt) {
        updateData.cookingStartedAt = new Date();
      } else if (status === 'READY' && !order.cookingFinishedAt) {
        updateData.cookingFinishedAt = new Date();
      } else if (status === 'ON_THE_WAY' && !order.dispatchedAt) {
        updateData.dispatchedAt = new Date();
      } else if (status === 'DELIVERED' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }
    if (currentStage) {
      updateData.currentStage = currentStage;
    }
    if (driverId !== undefined) {
      updateData.driver = driverId ? { connect: { id: driverId } } : { disconnect: true };
    }
    if (markPrebillPrinted) {
      updateData.prebillPrintedAt = new Date();
      updateData.prebillPrintedCount = { increment: 1 };
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 0. Process individual item updates if provided
      if (Array.isArray(itemUpdates) && itemUpdates.length > 0) {
        for (const itm of itemUpdates) {
          const itemUpdateData: Prisma.OrderItemUpdateInput = {
            status: itm.status,
          };
          if (itm.status === 'COOKING') {
            itemUpdateData.startedAt = new Date();
          } else if (itm.status === 'DONE') {
            itemUpdateData.finishedAt = new Date();
          }
          await tx.orderItem.update({
            where: { id: itm.id },
            data: itemUpdateData,
          });
        }

        // If order was in RECEIVED and items started cooking/done, move order to PREPARING
        if (order.status === 'RECEIVED' && !updateData.status) {
          updateData.status = 'PREPARING';
          if (!order.cookingStartedAt) {
            updateData.cookingStartedAt = new Date();
          }
        }

        // Check if all items in this order are now DONE
        const currentItems = await tx.orderItem.findMany({
          where: { orderId },
        });
        const allDone = currentItems.length > 0 && currentItems.every((i) => i.status === 'DONE');
        if (allDone && order.status !== 'DELIVERED') {
          updateData.status = 'READY';
          updateData.cookingFinishedAt = new Date();
        }
      }

      // Core requirement check: Deduct inventory stock if status is changing to DELIVERED
      const effectiveStatus = (updateData.status as string) || order.status;
      const isTransitioningToDelivered = effectiveStatus === 'DELIVERED' && order.status !== 'DELIVERED';
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

          // Deduct stock for modifier options if linked to an ingredient
          if (orderItem.modifiers) {
            try {
              const parsedMods = JSON.parse(orderItem.modifiers);
              if (Array.isArray(parsedMods)) {
                for (const mod of parsedMods) {
                  if (mod.ingredientId && mod.ingredientQuantity && mod.ingredientQuantity > 0) {
                    await tx.ingredient.update({
                      where: { id: mod.ingredientId },
                      data: {
                        stock: {
                          decrement: mod.ingredientQuantity * orderItem.quantity,
                        },
                      },
                    });
                  }
                }
              }
            } catch (err) {
              console.error('Error parsing orderItem modifiers for stock deduction:', err);
            }
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

    // Record Audit Log
    if (status === 'CANCELLED') {
      await recordAuditLog({
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: updatedOrder.id,
        details: {
          orderNumber: updatedOrder.orderNumber,
          previousStatus: order.status,
          total: updatedOrder.total,
          customerName: updatedOrder.customerName,
        },
        severity: 'CRITICAL',
        brandId: updatedOrder.brandId,
        userId: session.userId,
        req,
      });

      // Loss Prevention Anti-Fraud Check: Void after Pre-bill Print
      if (order.prebillPrintedAt) {
        await createSecurityIncident({
          brandId: updatedOrder.brandId,
          orderId: updatedOrder.id,
          type: 'POST_PREBILL_CANCEL',
          severity: 'CRITICAL',
          description: `Comanda #${updatedOrder.orderNumber} por $${updatedOrder.total.toFixed(2)} cancelada DESPUÉS de imprimir la pre-cuenta (${order.prebillPrintedCount} impresiones). Posible retención indebida de efectivo.`,
          amountAtRisk: updatedOrder.total,
          userId: session.userId,
          userName: session.email,
        });
      }
    } else if (status && status !== order.status) {
      await recordAuditLog({
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: updatedOrder.id,
        details: {
          orderNumber: updatedOrder.orderNumber,
          from: order.status,
          to: status,
        },
        severity: 'INFO',
        brandId: updatedOrder.brandId,
        userId: session.userId,
        req,
      });
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: unknown) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Error al actualizar el pedido' }, { status: 500 });
  }
}
