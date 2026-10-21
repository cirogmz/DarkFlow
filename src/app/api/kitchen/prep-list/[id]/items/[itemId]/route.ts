import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const userId = session.userId as string;
    const { id: prepListId, itemId } = await params;

    const body = await req.json();
    const {
      status,
      actualPrepQty,
      notes,
      action, // 'convert_batch' | 'update_status'
    } = body;

    // Verify prep list belongs to active brand
    const prepList = await prisma.dailyPrepList.findFirst({
      where: { id: prepListId, brandId: activeBrandId },
    });

    if (!prepList) {
      return NextResponse.json({ error: 'Lista de preparación no encontrada' }, { status: 404 });
    }

    // Find the item
    const prepItem = await prisma.dailyPrepItem.findFirst({
      where: { id: itemId, prepListId },
      include: {
        ingredient: {
          include: {
            parentSubRecipes: {
              include: {
                childIngredient: true,
              },
            },
          },
        },
      },
    });

    if (!prepItem) {
      return NextResponse.json({ error: 'Ítem de preparación no encontrado' }, { status: 404 });
    }

    // Handle One-Click Convert to Production Batch
    if (action === 'convert_batch') {
      if (!prepItem.ingredientId || !prepItem.ingredient) {
        return NextResponse.json(
          { error: 'Este ítem no está vinculado a una sub-receta de inventario' },
          { status: 400 }
        );
      }

      const ing = prepItem.ingredient;
      if (ing.parentSubRecipes.length === 0) {
        return NextResponse.json(
          { error: `La sub-receta "${ing.name}" no tiene materias primas base configuradas.` },
          { status: 400 }
        );
      }

      const qtyToProduce = actualPrepQty !== undefined ? parseFloat(actualPrepQty) : prepItem.suggestedPrepQty;
      if (qtyToProduce <= 0) {
        return NextResponse.json({ error: 'La cantidad a preparar debe ser mayor a 0' }, { status: 400 });
      }

      const yieldQty = ing.yieldQuantity || 1;
      const multiplier = qtyToProduce / yieldQty;

      // Validate child stock sufficiency
      for (const subItem of ing.parentSubRecipes) {
        const requiredQty = subItem.quantity * multiplier;
        if (subItem.childIngredient.stock < requiredQty) {
          return NextResponse.json(
            {
              error: `Stock insuficiente de "${subItem.childIngredient.name}". Requerido: ${requiredQty.toFixed(2)} ${subItem.childIngredient.unit}, Disponible: ${subItem.childIngredient.stock.toFixed(2)} ${subItem.childIngredient.unit}`,
            },
            { status: 400 }
          );
        }
      }

      // Execute atomic transaction: deduct child stock, increment prepared stock, record batch & audit
      const updatedItem = await prisma.$transaction(async (tx) => {
        let totalCost = 0;

        for (const subItem of ing.parentSubRecipes) {
          const qtyToDeduct = subItem.quantity * multiplier;
          const childCost = (subItem.childIngredient.cost || 0) * qtyToDeduct;
          totalCost += childCost;

          await tx.ingredient.update({
            where: { id: subItem.childIngredientId },
            data: {
              stock: { decrement: qtyToDeduct },
            },
          });
        }

        const unitCost = qtyToProduce > 0 ? totalCost / qtyToProduce : 0;

        // Increment prepared ingredient stock
        await tx.ingredient.update({
          where: { id: ing.id },
          data: {
            stock: { increment: qtyToProduce },
            cost: unitCost > 0 ? unitCost : ing.cost,
          },
        });

        // Create ProductionBatch
        const batch = await tx.productionBatch.create({
          data: {
            ingredientId: ing.id,
            quantity: qtyToProduce,
            totalCost,
            unitCost,
            notes: notes || `Generado automáticamente desde Prep List #${prepList.id.substring(0, 8)}`,
            brandId: activeBrandId,
            userId: userId || null,
          },
        });

        // Update DailyPrepItem
        const updated = await tx.dailyPrepItem.update({
          where: { id: itemId },
          data: {
            status: 'COMPLETED',
            actualPrepQty: qtyToProduce,
            productionBatchId: batch.id,
            completedAt: new Date(),
            completedById: userId || null,
            notes: notes || prepItem.notes,
          },
          include: {
            ingredient: true,
            product: true,
          },
        });

        // Check if all items in list are completed
        const allItems = await tx.dailyPrepItem.findMany({
          where: { prepListId },
        });

        const allCompleted = allItems.every((i) => i.id === itemId || i.status === 'COMPLETED');
        await tx.dailyPrepList.update({
          where: { id: prepListId },
          data: {
            status: allCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          },
        });

        return updated;
      });

      await recordAuditLog({
        action: 'PREP_ITEM_CONVERTED_TO_BATCH',
        entityType: 'DAILY_PREP_ITEM',
        entityId: itemId,
        brandId: activeBrandId,
        userId,
        severity: 'INFO',
        details: {
          itemName: prepItem.itemName,
          qtyProduced: qtyToProduce,
          unit: prepItem.unit,
          prepListId,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        message: `Lote de ${qtyToProduce} ${prepItem.unit} producido y stock descontado con éxito`,
        item: updatedItem,
      });
    }

    // Standard Status / Qty update
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.completedById = userId || null;
      }
    }

    if (actualPrepQty !== undefined) {
      updateData.actualPrepQty = parseFloat(actualPrepQty);
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.dailyPrepItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          ingredient: true,
          product: true,
        },
      });

      const allItems = await tx.dailyPrepItem.findMany({
        where: { prepListId },
      });

      const allCompleted = allItems.every((i) => i.status === 'COMPLETED');
      const anyProgress = allItems.some((i) => i.status === 'IN_PREP' || i.status === 'COMPLETED');

      await tx.dailyPrepList.update({
        where: { id: prepListId },
        data: {
          status: allCompleted ? 'COMPLETED' : anyProgress ? 'IN_PROGRESS' : 'DRAFT',
        },
      });

      return item;
    });

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (error: unknown) {
    console.error('Error updating prep item:', error);
    return NextResponse.json({ error: 'Error al actualizar ítem de preparación' }, { status: 500 });
  }
}
