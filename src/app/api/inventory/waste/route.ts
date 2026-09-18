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

    const wasteLogs = await prisma.wasteLog.findMany({
      where: { brandId: activeBrandId },
      include: {
        ingredient: true,
        warehouse: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalWasteCost = 0;
    const reasonBreakdown: Record<string, { count: number; cost: number }> = {
      EXPIRATION: { count: 0, cost: 0 },
      KITCHEN_ERROR: { count: 0, cost: 0 },
      PREPARATION_WASTE: { count: 0, cost: 0 },
      DAMAGE_SPILL: { count: 0, cost: 0 },
      OTHER: { count: 0, cost: 0 },
    };

    for (const log of wasteLogs) {
      totalWasteCost += log.totalCost;
      const key = reasonBreakdown[log.reason] ? log.reason : 'OTHER';
      reasonBreakdown[key].count += 1;
      reasonBreakdown[key].cost += log.totalCost;
    }

    return NextResponse.json({
      wasteLogs,
      summary: {
        totalWasteCost,
        totalEvents: wasteLogs.length,
        reasonBreakdown,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching waste logs:', error);
    return NextResponse.json({ error: 'Error al consultar mermas' }, { status: 500 });
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
    const { ingredientId, quantity, reason, warehouseId, notes } = body;

    if (!ingredientId || !quantity || !reason) {
      return NextResponse.json({ error: 'Insumo, cantidad y motivo son obligatorios' }, { status: 400 });
    }

    const wasteQty = parseFloat(quantity);
    if (wasteQty <= 0) {
      return NextResponse.json({ error: 'La cantidad de merma debe ser mayor a 0' }, { status: 400 });
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: ingredientId, brandId: activeBrandId },
    });

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
    }

    const costPerUnit = ingredient.cost;
    const totalCost = costPerUnit * wasteQty;

    const result = await prisma.$transaction(async (tx) => {
      // Decrement main ingredient stock
      const updatedIngredient = await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: {
            decrement: wasteQty,
          },
        },
      });

      // If warehouse is specified, decrement warehouse stock as well
      if (warehouseId) {
        await tx.warehouseStock.upsert({
          where: {
            warehouseId_ingredientId: {
              warehouseId,
              ingredientId,
            },
          },
          update: {
            stock: {
              decrement: wasteQty,
            },
          },
          create: {
            warehouseId,
            ingredientId,
            stock: -wasteQty,
          },
        });
      }

      const wasteLog = await tx.wasteLog.create({
        data: {
          ingredientId,
          quantity: wasteQty,
          costPerUnit,
          totalCost,
          reason,
          notes: notes ? String(notes).trim() : null,
          warehouseId: warehouseId || null,
          brandId: activeBrandId,
          userId: session.userId,
        },
        include: {
          ingredient: true,
          warehouse: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return { wasteLog, updatedIngredient };
    });

    await recordAuditLog({
      action: 'WASTE_RECORDED',
      entityType: 'INGREDIENT',
      entityId: ingredient.id,
      details: {
        ingredientName: ingredient.name,
        quantity: wasteQty,
        unit: ingredient.unit,
        reason,
        totalCost,
        notes,
      },
      severity: 'WARNING',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Error recording waste:', error);
    return NextResponse.json({ error: 'Error al registrar la merma' }, { status: 500 });
  }
}
