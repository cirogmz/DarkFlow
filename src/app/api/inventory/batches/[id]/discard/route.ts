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

    const {
      quantity,
      reason = 'CADUCIDAD / VENCIMIENTO',
      notes,
    } = body;

    const discardQty = parseFloat(quantity);
    if (isNaN(discardQty) || discardQty <= 0) {
      return NextResponse.json({ error: 'La cantidad a descartar debe ser mayor a 0' }, { status: 400 });
    }

    const batch = await prisma.ingredientBatch.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        ingredient: true,
        warehouse: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    if (batch.currentQuantity < discardQty) {
      return NextResponse.json({
        error: `La cantidad a descartar (${discardQty}) excede el stock actual del lote (${batch.currentQuantity})`,
      }, { status: 400 });
    }

    const totalCost = Math.round(discardQty * batch.unitCost * 100) / 100;

    // Atomic transaction for batch discard and waste logging
    const result = await prisma.$transaction(async (tx) => {
      const remainingQty = Math.max(0, batch.currentQuantity - discardQty);
      const isFullyDepleted = remainingQty <= 0.0001;

      // Update batch
      const updatedBatch = await tx.ingredientBatch.update({
        where: { id: batch.id },
        data: {
          currentQuantity: remainingQty,
          status: isFullyDepleted ? 'DISCARDED' : batch.status,
        },
      });

      // Deduct from Ingredient general stock
      await tx.ingredient.update({
        where: { id: batch.ingredientId },
        data: {
          stock: { decrement: discardQty },
        },
      });

      // Deduct from warehouse stock if batch is assigned to warehouse
      if (batch.warehouseId) {
        await tx.warehouseStock.updateMany({
          where: {
            warehouseId: batch.warehouseId,
            ingredientId: batch.ingredientId,
          },
          data: {
            stock: { decrement: discardQty },
          },
        });
      }

      // Create WasteLog record
      const wasteLog = await tx.wasteLog.create({
        data: {
          ingredientId: batch.ingredientId,
          quantity: discardQty,
          costPerUnit: batch.unitCost,
          totalCost,
          reason,
          notes: notes ? `${notes} (Lote: ${batch.batchNumber})` : `Merma por caducidad de lote ${batch.batchNumber}`,
          warehouseId: batch.warehouseId,
          brandId: activeBrandId,
          userId: session.userId,
          batchId: batch.id,
        },
      });

      return { updatedBatch, wasteLog };
    });

    await recordAuditLog({
      action: 'BATCH_DISCARDED_AS_WASTE',
      entityType: 'INGREDIENT_BATCH',
      entityId: batch.id,
      details: {
        batchNumber: batch.batchNumber,
        ingredientName: batch.ingredient.name,
        discardQuantity: discardQty,
        totalCost,
        reason,
        wasteLogId: result.wasteLog.id,
      },
      severity: 'WARNING',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Se descartaron ${discardQty} ${batch.ingredient.unit} del lote ${batch.batchNumber} exitosamente`,
      batch: result.updatedBatch,
      wasteLog: result.wasteLog,
    });
  } catch (error: unknown) {
    console.error('Error discarding batch quantity:', error);
    return NextResponse.json({ error: 'Error al registrar merma del lote' }, { status: 500 });
  }
}
