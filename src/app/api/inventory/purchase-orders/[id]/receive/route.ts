import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
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
    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();
    const { receivedItems, invoiceRef, notes } = body;

    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      return NextResponse.json({ error: 'Debe especificar los insumos recibidos' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        supplier: true,
        items: {
          include: { ingredient: true },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    if (po.status === 'RECEIVED') {
      return NextResponse.json({ error: 'Esta orden ya ha sido recibida en su totalidad' }, { status: 400 });
    }

    if (po.status === 'CANCELLED') {
      return NextResponse.json({ error: 'No se puede recibir mercancía de una orden cancelada' }, { status: 400 });
    }

    // Atomic transaction for receiving items and updating inventory & PPP
    const result = await prisma.$transaction(async (tx) => {
      const itemMap = new Map(po.items.map((it) => [it.id, it]));

      for (const rx of receivedItems) {
        const item = itemMap.get(rx.itemId);
        if (!item) continue;

        const qtyReceivedNow = parseFloat(rx.quantityReceived) || 0;
        if (qtyReceivedNow <= 0) continue;

        const actualUnitCost = rx.unitCost !== undefined && !isNaN(parseFloat(rx.unitCost))
          ? parseFloat(rx.unitCost)
          : item.unitCost;

        // Current ingredient state
        const ing = await tx.ingredient.findUnique({
          where: { id: item.ingredientId },
        });

        if (!ing) continue;

        // Calculate Weighted Average Cost (Costo Promedio Ponderado - PPP)
        const currentStock = Math.max(0, ing.stock);
        const currentCost = ing.cost || 0;
        const totalStock = currentStock + qtyReceivedNow;
        const weightedCost = totalStock > 0 
          ? ((currentStock * currentCost) + (qtyReceivedNow * actualUnitCost)) / totalStock 
          : actualUnitCost;

        // Update ingredient stock and average unit cost
        await tx.ingredient.update({
          where: { id: ing.id },
          data: {
            stock: { increment: qtyReceivedNow },
            cost: Math.round(weightedCost * 10000) / 10000, // 4 decimal precision
          },
        });

        // Update purchase order item
        const newTotalReceived = item.quantityReceived + qtyReceivedNow;
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: newTotalReceived,
            unitCost: actualUnitCost,
            totalCost: item.quantityOrdered * actualUnitCost,
          },
        });

        // Record entry in legacy Purchase model for historical reporting and audit parity
        await tx.purchase.create({
          data: {
            ingredientId: ing.id,
            quantity: qtyReceivedNow,
            cost: qtyReceivedNow * actualUnitCost,
            supplier: po.supplier.name,
            brandId: activeBrandId,
          },
        });

        // Traceability: Create IngredientBatch for received quantity (FEFO / FIFO)
        const expDate = rx.expirationDate
          ? new Date(rx.expirationDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days

        const batchNum = rx.batchNumber?.trim() ||
          `LOT-${po.folio.replace(/[^a-zA-Z0-9]/g, '')}-${ing.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        await tx.ingredientBatch.create({
          data: {
            brandId: activeBrandId,
            ingredientId: ing.id,
            batchNumber: batchNum,
            initialQuantity: qtyReceivedNow,
            currentQuantity: qtyReceivedNow,
            unitCost: actualUnitCost,
            expirationDate: expDate,
            receivedDate: new Date(),
            supplierId: po.supplierId,
            status: 'ACTIVE',
            notes: `Recepción ${po.folio}${rx.notes ? ' | ' + rx.notes : ''}`,
          },
        });
      }

      // Re-fetch items to verify fulfillment status
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allFulfilled = updatedItems.every((it) => it.quantityReceived >= it.quantityOrdered);
      const someReceived = updatedItems.some((it) => it.quantityReceived > 0);

      const nextStatus = allFulfilled 
        ? 'RECEIVED' 
        : (someReceived ? 'PARTIALLY_RECEIVED' : po.status);

      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedDate: new Date(),
          receivedById: session.userId,
          invoiceRef: invoiceRef ? String(invoiceRef).trim() : po.invoiceRef,
          notes: notes ? `${po.notes ? po.notes + ' | ' : ''}Recepción: ${notes}` : po.notes,
        },
        include: {
          supplier: true,
          createdBy: { select: { id: true, name: true, email: true } },
          receivedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { ingredient: true },
          },
        },
      });

      return updatedPO;
    });

    await recordAuditLog({
      action: 'PURCHASE_ORDER_RECEIVED',
      entityType: 'PURCHASE_ORDER',
      entityId: result.id,
      details: {
        folio: result.folio,
        supplierName: result.supplier.name,
        invoiceRef: result.invoiceRef,
        status: result.status,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, purchaseOrder: result });
  } catch (error: unknown) {
    console.error('Error receiving purchase order items:', error);
    return NextResponse.json({ error: 'Error al procesar la recepción de mercancía' }, { status: 500 });
  }
}
