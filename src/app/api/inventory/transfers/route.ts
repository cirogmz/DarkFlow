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

    const transfers = await prisma.warehouseTransfer.findMany({
      where: { brandId: activeBrandId },
      include: {
        ingredient: true,
        fromWarehouse: true,
        toWarehouse: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ transfers });
  } catch (error: unknown) {
    console.error('Error fetching warehouse transfers:', error);
    return NextResponse.json({ error: 'Error al consultar traspasos' }, { status: 500 });
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
    const { ingredientId, quantity, fromWarehouseId, toWarehouseId, notes } = body;

    if (!ingredientId || !quantity || !fromWarehouseId || !toWarehouseId) {
      return NextResponse.json({ error: 'Insumo, cantidad, almacén origen y destino son obligatorios' }, { status: 400 });
    }

    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ error: 'El almacén de origen y destino no pueden ser el mismo' }, { status: 400 });
    }

    const transferQty = parseFloat(quantity);
    if (transferQty <= 0) {
      return NextResponse.json({ error: 'La cantidad a traspasar debe ser mayor a 0' }, { status: 400 });
    }

    const [ingredient, fromWarehouse, toWarehouse] = await Promise.all([
      prisma.ingredient.findFirst({ where: { id: ingredientId, brandId: activeBrandId } }),
      prisma.warehouse.findFirst({ where: { id: fromWarehouseId, brandId: activeBrandId } }),
      prisma.warehouse.findFirst({ where: { id: toWarehouseId, brandId: activeBrandId } }),
    ]);

    if (!ingredient || !fromWarehouse || !toWarehouse) {
      return NextResponse.json({ error: 'Insumo o almacén no encontrado' }, { status: 404 });
    }

    // Check source warehouse stock
    const sourceStock = await prisma.warehouseStock.findUnique({
      where: {
        warehouseId_ingredientId: {
          warehouseId: fromWarehouseId,
          ingredientId,
        },
      },
    });

    // If source warehouse stock doesn't exist yet, we check total ingredient stock as fallback
    const availableSourceStock = sourceStock ? sourceStock.stock : ingredient.stock;
    if (availableSourceStock < transferQty) {
      return NextResponse.json(
        {
          error: `Stock insuficiente en ${fromWarehouse.name}. Disponible: ${availableSourceStock.toFixed(2)} ${ingredient.unit}, Requerido: ${transferQty.toFixed(2)} ${ingredient.unit}`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Decrement from source
      await tx.warehouseStock.upsert({
        where: {
          warehouseId_ingredientId: {
            warehouseId: fromWarehouseId,
            ingredientId,
          },
        },
        update: {
          stock: {
            decrement: transferQty,
          },
        },
        create: {
          warehouseId: fromWarehouseId,
          ingredientId,
          stock: availableSourceStock - transferQty,
        },
      });

      // Increment in destination
      await tx.warehouseStock.upsert({
        where: {
          warehouseId_ingredientId: {
            warehouseId: toWarehouseId,
            ingredientId,
          },
        },
        update: {
          stock: {
            increment: transferQty,
          },
        },
        create: {
          warehouseId: toWarehouseId,
          ingredientId,
          stock: transferQty,
        },
      });

      const transfer = await tx.warehouseTransfer.create({
        data: {
          ingredientId,
          quantity: transferQty,
          fromWarehouseId,
          toWarehouseId,
          notes: notes ? String(notes).trim() : null,
          brandId: activeBrandId,
          userId: session.userId,
        },
        include: {
          ingredient: true,
          fromWarehouse: true,
          toWarehouse: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return transfer;
    });

    await recordAuditLog({
      action: 'WAREHOUSE_TRANSFER',
      entityType: 'INGREDIENT',
      entityId: ingredient.id,
      details: {
        ingredientName: ingredient.name,
        quantity: transferQty,
        unit: ingredient.unit,
        from: fromWarehouse.name,
        to: toWarehouse.name,
        notes,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, transfer: result });
  } catch (error: unknown) {
    console.error('Error recording warehouse transfer:', error);
    return NextResponse.json({ error: 'Error al procesar el traspaso' }, { status: 500 });
  }
}
