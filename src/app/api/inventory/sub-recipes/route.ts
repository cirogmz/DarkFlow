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

    const subRecipes = await prisma.ingredient.findMany({
      where: {
        brandId: activeBrandId,
        type: 'PREPARED',
      },
      include: {
        parentSubRecipes: {
          include: {
            childIngredient: true,
          },
        },
        productionBatches: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
    });

    const rawIngredients = await prisma.ingredient.findMany({
      where: {
        brandId: activeBrandId,
        type: 'RAW',
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subRecipes, rawIngredients });
  } catch (error: unknown) {
    console.error('Error fetching sub-recipes:', error);
    return NextResponse.json({ error: 'Error al consultar sub-recetas' }, { status: 500 });
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
    const { id, name, unit, yieldQuantity, yieldUnit, minStock, childItems } = body;

    if (!name || !unit || !yieldQuantity || !Array.isArray(childItems) || childItems.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para la sub-receta' }, { status: 400 });
    }

    const parsedYieldQty = parseFloat(yieldQuantity);
    if (parsedYieldQty <= 0) {
      return NextResponse.json({ error: 'El rendimiento debe ser mayor a 0' }, { status: 400 });
    }

    // Fetch child ingredients to calculate total cost
    const childIds = childItems.map((ci: { childIngredientId: string }) => ci.childIngredientId);
    const dbChildren = await prisma.ingredient.findMany({
      where: { id: { in: childIds }, brandId: activeBrandId },
    });

    const childMap = new Map(dbChildren.map((c) => [c.id, c]));
    let totalBatchCost = 0;

    for (const item of childItems) {
      const child = childMap.get(item.childIngredientId);
      if (!child) {
        return NextResponse.json({ error: `Insumo base con ID ${item.childIngredientId} no encontrado` }, { status: 400 });
      }
      const qty = parseFloat(item.quantity) || 0;
      totalBatchCost += child.cost * qty;
    }

    const unitCost = totalBatchCost / parsedYieldQty;

    const saved = await prisma.$transaction(async (tx) => {
      let preparedIng;
      if (id) {
        preparedIng = await tx.ingredient.update({
          where: { id },
          data: {
            name: name.trim(),
            unit: unit.trim(),
            yieldQuantity: parsedYieldQty,
            yieldUnit: yieldUnit ? yieldUnit.trim() : unit.trim(),
            cost: unitCost,
            minStock: minStock !== undefined ? parseFloat(minStock) : 0,
            type: 'PREPARED',
          },
        });

        // Delete previous subRecipeItems
        await tx.subRecipeItem.deleteMany({
          where: { parentIngredientId: id },
        });
      } else {
        preparedIng = await tx.ingredient.create({
          data: {
            name: name.trim(),
            unit: unit.trim(),
            yieldQuantity: parsedYieldQty,
            yieldUnit: yieldUnit ? yieldUnit.trim() : unit.trim(),
            cost: unitCost,
            minStock: minStock !== undefined ? parseFloat(minStock) : 0,
            type: 'PREPARED',
            brandId: activeBrandId,
          },
        });
      }

      // Create new subRecipeItems
      await tx.subRecipeItem.createMany({
        data: childItems.map((ci: { childIngredientId: string; quantity: number | string }) => ({
          parentIngredientId: preparedIng.id,
          childIngredientId: ci.childIngredientId,
          quantity: parseFloat(String(ci.quantity)),
        })),
      });

      return preparedIng;
    });

    await recordAuditLog({
      action: id ? 'SUB_RECIPE_UPDATED' : 'SUB_RECIPE_CREATED',
      entityType: 'INGREDIENT',
      entityId: saved.id,
      details: {
        name: saved.name,
        unit: saved.unit,
        yieldQuantity: saved.yieldQuantity,
        unitCost,
        childCount: childItems.length,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, subRecipe: saved });
  } catch (error: unknown) {
    console.error('Error saving sub-recipe:', error);
    return NextResponse.json({ error: 'Error al guardar la sub-receta' }, { status: 500 });
  }
}
