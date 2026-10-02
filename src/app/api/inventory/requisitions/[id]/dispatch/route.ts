import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { generateDispatchGuideNumber } from '@/lib/requisitions';
import { recordAuditLog } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { dispatchedItems, dispatchGuide, notes } = body;

    const requisition = await prisma.internalRequisition.findFirst({
      where: { id, brandId: session.activeBrandId },
      include: {
        items: { include: { ingredient: true } },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisición no encontrada' }, { status: 404 });
    }

    if (requisition.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Solo se pueden despachar requisiciones aprobadas (Estado actual: ${requisition.status})` },
        { status: 400 }
      );
    }

    const dispatchedQtyMap = new Map<string, number>();
    if (Array.isArray(dispatchedItems)) {
      for (const it of dispatchedItems) {
        dispatchedQtyMap.set(it.itemId, Number(it.dispatchedQty) || 0);
      }
    }

    const guide = dispatchGuide || (await generateDispatchGuideNumber(session.activeBrandId));

    const result = await prisma.$transaction(async (tx: any) => {
      for (const item of requisition.items) {
        const dispatchedQty = dispatchedQtyMap.has(item.id)
          ? dispatchedQtyMap.get(item.id)!
          : item.approvedQty;

        // 1. Descontar del inventario del insumo en origen
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stock: { decrement: dispatchedQty },
          },
        });

        // Si hay bodega origen configurada, descontar de WarehouseStock
        if (requisition.fromWarehouseId) {
          await tx.warehouseStock.upsert({
            where: {
              warehouseId_ingredientId: {
                warehouseId: requisition.fromWarehouseId,
                ingredientId: item.ingredientId,
              },
            },
            create: {
              warehouseId: requisition.fromWarehouseId,
              ingredientId: item.ingredientId,
              stock: -dispatchedQty,
            },
            update: {
              stock: { decrement: dispatchedQty },
            },
          });
        }

        // 2. Actualizar cantidad despachada en la requisición
        await tx.requisitionItem.update({
          where: { id: item.id },
          data: { dispatchedQty },
        });
      }

      // 3. Actualizar estado de la requisición a DISPATCHED
      return tx.internalRequisition.update({
        where: { id },
        data: {
          status: 'DISPATCHED',
          dispatchGuide: guide,
          dispatchedById: session.userId,
          dispatchedAt: new Date(),
          notes: notes ? `${requisition.notes || ''} [Despacho: ${notes}]` : requisition.notes,
        },
        include: {
          items: { include: { ingredient: true } },
          fromWarehouse: true,
          toWarehouse: true,
          requestedBy: true,
          approvedBy: true,
          dispatchedBy: true,
        },
      });
    });

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'INTERNAL_REQUISITION_DISPATCHED',
      entityType: 'REQUISITION',
      entityId: id,
      severity: 'INFO',
      details: `Requisición ${requisition.folio} despachada con Guía ${guide} por ${session.name}. Mercancía en tránsito.`,
      req,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error dispatching requisition:', error);
    return NextResponse.json(
      { error: 'Error al despachar mercancía', details: error.message },
      { status: 500 }
    );
  }
}
