import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
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
    const { receivedItems, notes } = body;

    const requisition = await prisma.internalRequisition.findFirst({
      where: { id, brandId: session.activeBrandId },
      include: {
        items: { include: { ingredient: true } },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisición no encontrada' }, { status: 404 });
    }

    if (requisition.status !== 'DISPATCHED') {
      return NextResponse.json(
        { error: `Solo se pueden recibir requisiciones en tránsito / despachadas (Estado actual: ${requisition.status})` },
        { status: 400 }
      );
    }

    const receivedQtyMap = new Map<string, { qty: number; notes?: string }>();
    if (Array.isArray(receivedItems)) {
      for (const it of receivedItems) {
        receivedQtyMap.set(it.itemId, {
          qty: Number(it.receivedQty) || 0,
          notes: it.notes,
        });
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      let totalDiscrepancyCost = 0;

      for (const item of requisition.items) {
        const itemReceipt = receivedQtyMap.has(item.id)
          ? receivedQtyMap.get(item.id)!
          : { qty: item.dispatchedQty, notes: undefined };

        const receivedQty = itemReceipt.qty;
        const discrepancyQty = receivedQty - item.dispatchedQty;
        const discrepancyCost = discrepancyQty * item.unitCost;

        totalDiscrepancyCost += discrepancyCost;

        // 1. Ingresar las existencias recibidas a inventario de destino
        // (Nota: si fromWarehouseId y toWarehouseId son bodegas internas de la misma marca, Ingredient.stock total global se resta en despacho y suma en recepción; pero si era entre bodegas, el stock físico en la bodega destino debe aumentar)
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stock: { increment: receivedQty },
          },
        });

        if (requisition.toWarehouseId) {
          await tx.warehouseStock.upsert({
            where: {
              warehouseId_ingredientId: {
                warehouseId: requisition.toWarehouseId,
                ingredientId: item.ingredientId,
              },
            },
            create: {
              warehouseId: requisition.toWarehouseId,
              ingredientId: item.ingredientId,
              stock: receivedQty,
            },
            update: {
              stock: { increment: receivedQty },
            },
          });
        }

        // 2. Si hubo faltante (merma en traslado / rotura / pérdida), registrar en WasteLog
        if (discrepancyQty < 0) {
          const absLossQty = Math.abs(discrepancyQty);
          const absLossCost = Math.abs(discrepancyCost);

          await tx.wasteLog.create({
            data: {
              brandId: session.activeBrandId,
              ingredientId: item.ingredientId,
              quantity: absLossQty,
              costPerUnit: item.unitCost,
              totalCost: absLossCost,
              reason: `MERMA EN TRASLADO (GUÍA ${requisition.dispatchGuide || requisition.folio})`,
              notes: itemReceipt.notes || `Discrepancia en recepción de requisición ${requisition.folio}`,
              warehouseId: requisition.toWarehouseId,
              userId: session.userId,
            },
          });
        }

        // 3. Actualizar ítem de la requisición con cantidades finales recibidas
        await tx.requisitionItem.update({
          where: { id: item.id },
          data: {
            receivedQty,
            discrepancyQty,
            notes: itemReceipt.notes || item.notes,
          },
        });
      }

      // 4. Sellar requisición como RECEIVED
      return tx.internalRequisition.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedById: session.userId,
          receivedAt: new Date(),
          totalDiscrepancyCost: Number(totalDiscrepancyCost.toFixed(2)),
          notes: notes ? `${requisition.notes || ''} [Recepción: ${notes}]` : requisition.notes,
        },
        include: {
          items: { include: { ingredient: true } },
          fromWarehouse: true,
          toWarehouse: true,
          requestedBy: true,
          approvedBy: true,
          dispatchedBy: true,
          receivedBy: true,
        },
      });
    });

    const isCritical = result.totalDiscrepancyCost < -200;

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'INTERNAL_REQUISITION_RECEIVED',
      entityType: 'REQUISITION',
      entityId: id,
      severity: isCritical ? 'CRITICAL' : result.totalDiscrepancyCost < 0 ? 'WARNING' : 'INFO',
      details: `Requisición ${requisition.folio} recibida por ${session.name}. Discrepancia neta: $${result.totalDiscrepancyCost.toFixed(2)}. ${result.totalDiscrepancyCost < 0 ? 'Mermas de transporte registradas automáticamente.' : 'Recepción conforme al 100%.'}`,
      req,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error receiving requisition:', error);
    return NextResponse.json(
      { error: 'Error al procesar recepción de mercancía', details: error.message },
      { status: 500 }
    );
  }
}
