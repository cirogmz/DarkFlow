import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = id;
    const { targetStage } = await req.json();

    if (!targetStage || !['STARTER', 'MAIN', 'DESSERT'].includes(targetStage)) {
      return NextResponse.json({ error: 'Etapa de cocina no válida' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: true,
      },
    });

    if (!order || order.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update order stage
      const ord = await tx.order.update({
        where: { id: orderId },
        data: {
          currentStage: targetStage,
          status: 'PREPARING',
        },
      });

      // 2. Advance items belonging to this service stage to COOKING if they were PENDING
      await tx.orderItem.updateMany({
        where: {
          orderId,
          serviceStage: targetStage,
          status: 'PENDING',
        },
        data: {
          status: 'COOKING',
          startedAt: new Date(),
        },
      });

      return ord;
    });

    // Broadcast KDS event
    orderEvents.emit('order_updated', {
      id: order.id,
      orderNumber: order.orderNumber,
      brandId: session.activeBrandId,
      currentStage: targetStage,
      tableNumber: order.table?.number,
      action: 'STAGE_ADVANCED',
    });

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'WAITER_STAGE_ADVANCED',
      entityType: 'Order',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        tableNumber: order.table?.number,
        newStage: targetStage,
      },
      req,
    });

    const stageNames: Record<string, string> = {
      STARTER: 'Entradas',
      MAIN: 'Platos Fuertes',
      DESSERT: 'Postres',
    };

    return NextResponse.json({
      success: true,
      currentStage: targetStage,
      message: `¡${stageNames[targetStage] || targetStage} marchados a cocina con éxito!`,
    });
  } catch (error: unknown) {
    console.error('Error advancing order stage:', error);
    return NextResponse.json({ error: 'Error al marchar tiempo de servicio' }, { status: 500 });
  }
}
