import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const batches = await prisma.productionBatch.findMany({
      where: { brandId: activeBrandId },
      include: {
        ingredient: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ batches });
  } catch (error: unknown) {
    console.error('Error fetching production batches:', error);
    return NextResponse.json({ error: 'Error al consultar lotes de producción' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();
    const { ingredientId, quantity, notes } = body;

    if (!ingredientId || !quantity) {
      return NextResponse.json({ error: 'Insumo y cantidad son obligatorios' }, { status: 400 });
    }

    const produceQty = parseFloat(quantity);
    if (produceQty <= 0) {
      return NextResponse.json({ error: 'La cantidad a producir debe ser mayor a 0' }, { status: 400 });
    }

    // Find the prepared ingredient and its sub-recipe recipe items
    const prepared = await prisma.ingredient.findFirst({
      where: { id: ingredientId, brandId: activeBrandId, type: 'PREPARED' },
      include: {
        parentSubRecipes: {
          include: {
            childIngredient: true,
          },
        },
      },
    });

    if (!prepared) {
      return NextResponse.json({ error: 'Insumo preparado / sub-receta no encontrado' }, { status: 404 });
    }

    if (prepared.parentSubRecipes.length === 0) {
      return NextResponse.json({ error: 'Esta sub-receta no tiene ingredientes base configurados' }, { status: 400 });
    }

    const yieldQty = prepared.yieldQuantity || 1;
    const multiplier = produceQty / yieldQty;

    // Check availability of child ingredients
    for (const subItem of prepared.parentSubRecipes) {
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

    // Run atomic transaction to decrement child stocks, increment prepared stock, and record batch
    const result = await prisma.$transaction(async (tx) => {
      let totalCost = 0;

      for (const subItem of prepared.parentSubRecipes) {
        const requiredQty = subItem.quantity * multiplier;
        const itemCost = subItem.childIngredient.cost * requiredQty;
        totalCost += itemCost;

        await tx.ingredient.update({
          where: { id: subItem.childIngredientId },
          data: {
            stock: {
              decrement: requiredQty,
            },
          },
        });
      }

      const unitCost = totalCost / produceQty;

      const updatedPrepared = await tx.ingredient.update({
        where: { id: prepared.id },
        data: {
          stock: {
            increment: produceQty,
          },
          cost: unitCost,
        },
      });

      const batch = await tx.productionBatch.create({
        data: {
          ingredientId: prepared.id,
          quantity: produceQty,
          totalCost,
          unitCost,
          notes: notes ? String(notes).trim() : null,
          brandId: activeBrandId,
          userId: session.userId,
        },
        include: {
          ingredient: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return { batch, updatedPrepared };
    });

    await recordAuditLog({
      action: 'PRODUCTION_BATCH_RECORDED',
      entityType: 'INGREDIENT',
      entityId: prepared.id,
      details: {
        ingredientName: prepared.name,
        producedQuantity: produceQty,
        unit: prepared.unit,
        totalCost: result.batch.totalCost,
        unitCost: result.batch.unitCost,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Error executing production batch:', error);
    return NextResponse.json({ error: 'Error al procesar lote de producción' }, { status: 500 });
  }
}
