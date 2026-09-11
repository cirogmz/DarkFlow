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

    const ingredients = await prisma.ingredient.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        recipeItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const purchases = await prisma.purchase.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        ingredient: true,
      },
      orderBy: { purchaseDate: 'desc' },
    });

    return NextResponse.json({ ingredients, purchases });
  } catch (error: unknown) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
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
    const { action, ingredientId, name, unit, minStock, stock, cost, quantity, supplier, newStock, reason } = body;

    if (action === 'new_ingredient') {
      if (!name || !unit) {
        return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
      }

      const ing = await prisma.ingredient.create({
        data: {
          name,
          unit,
          stock: stock ? parseFloat(stock) : 0,
          minStock: minStock ? parseFloat(minStock) : 0,
          cost: cost ? parseFloat(cost) : 0,
          brandId: activeBrandId,
        },
      });

      await recordAuditLog({
        action: 'INGREDIENT_CREATED',
        entityType: 'INGREDIENT',
        entityId: ing.id,
        details: { name: ing.name, unit: ing.unit, initialStock: ing.stock, cost: ing.cost },
        severity: 'INFO',
        brandId: activeBrandId,
        userId: session.userId,
        req,
      });

      return NextResponse.json({ success: true, ingredient: ing });
    }

    if (action === 'purchase') {
      if (!ingredientId || !quantity || !cost) {
        return NextResponse.json({ error: 'Faltan datos de compra' }, { status: 400 });
      }

      const parsedQty = parseFloat(quantity);
      const parsedCost = parseFloat(cost);

      // Perform transaction to record purchase and increment stock
      const result = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            ingredientId,
            quantity: parsedQty,
            cost: parsedCost,
            supplier: supplier || null,
            brandId: activeBrandId,
          },
        });

        const updatedIngredient = await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            stock: {
              increment: parsedQty,
            },
            cost: parsedCost / parsedQty, // update average cost
          },
        });

        return { purchase, updatedIngredient };
      });

      await recordAuditLog({
        action: 'PURCHASE_RECORDED',
        entityType: 'PURCHASE',
        entityId: result.purchase.id,
        details: {
          ingredientId,
          ingredientName: result.updatedIngredient.name,
          quantity: parsedQty,
          cost: parsedCost,
          supplier: supplier || 'N/A',
          newStock: result.updatedIngredient.stock,
        },
        severity: 'INFO',
        brandId: activeBrandId,
        userId: session.userId,
        req,
      });

      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'adjust_stock') {
      if (!ingredientId || newStock === undefined) {
        return NextResponse.json({ error: 'Faltan datos de ajuste de stock' }, { status: 400 });
      }

      const currentIng = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
      });

      if (!currentIng || currentIng.brandId !== activeBrandId) {
        return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
      }

      const parsedNewStock = parseFloat(newStock);
      const oldStock = currentIng.stock;
      const difference = parsedNewStock - oldStock;

      const updated = await prisma.ingredient.update({
        where: { id: ingredientId },
        data: { stock: parsedNewStock },
      });

      await recordAuditLog({
        action: 'STOCK_ADJUSTED',
        entityType: 'INGREDIENT',
        entityId: currentIng.id,
        details: {
          ingredientName: currentIng.name,
          oldStock,
          newStock: parsedNewStock,
          difference,
          unit: currentIng.unit,
          reason: reason || 'Ajuste manual de inventario',
        },
        severity: 'WARNING',
        brandId: activeBrandId,
        userId: session.userId,
        req,
      });

      return NextResponse.json({ success: true, ingredient: updated });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error modifying inventory:', error);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { ingredientId, newStock, reason } = await req.json();

    if (!ingredientId || newStock === undefined) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const currentIng = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!currentIng || currentIng.brandId !== activeBrandId) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
    }

    const parsedNewStock = parseFloat(newStock);
    const oldStock = currentIng.stock;
    const difference = parsedNewStock - oldStock;

    const updated = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { stock: parsedNewStock },
    });

    await recordAuditLog({
      action: 'STOCK_ADJUSTED',
      entityType: 'INGREDIENT',
      entityId: currentIng.id,
      details: {
        ingredientName: currentIng.name,
        oldStock,
        newStock: parsedNewStock,
        difference,
        unit: currentIng.unit,
        reason: reason || 'Ajuste manual de inventario',
      },
      severity: 'WARNING',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, ingredient: updated });
  } catch (error: unknown) {
    console.error('Error adjusting stock:', error);
    return NextResponse.json({ error: 'Error al ajustar stock' }, { status: 500 });
  }
}

// Add/update recipe mappings
export async function PUT(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { productId, ingredientId, quantity } = await req.json();

    if (!productId || !ingredientId || quantity === undefined) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    const qtyVal = parseFloat(quantity);

    if (qtyVal <= 0) {
      // Delete recipe item if quantity is zero
      await prisma.recipeItem.deleteMany({
        where: {
          productId,
          ingredientId,
        },
      });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Upsert recipe mapping
    const recipeItem = await prisma.recipeItem.upsert({
      where: {
        productId_ingredientId: {
          productId,
          ingredientId,
        },
      },
      update: {
        quantity: qtyVal,
      },
      create: {
        productId,
        ingredientId,
        quantity: qtyVal,
      },
    });

    return NextResponse.json({ success: true, recipeItem });
  } catch (error: unknown) {
    console.error('Error updating recipe:', error);
    return NextResponse.json({ error: 'Error al actualizar receta' }, { status: 500 });
  }
}
