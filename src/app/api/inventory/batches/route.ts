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
    const { searchParams } = new URL(req.url);
    const ingredientId = searchParams.get('ingredientId');
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim().toLowerCase();
    const sort = searchParams.get('sort') || 'FEFO'; // 'FEFO', 'FIFO', 'STOCK_DESC'

    const where: any = {
      brandId: activeBrandId,
    };

    if (ingredientId) {
      where.ingredientId = ingredientId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    let orderBy: any = { expirationDate: 'asc' };
    if (sort === 'FIFO') {
      orderBy = { receivedDate: 'asc' };
    } else if (sort === 'STOCK_DESC') {
      orderBy = { currentQuantity: 'desc' };
    }

    const rawBatches = await prisma.ingredientBatch.findMany({
      where,
      orderBy,
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
            cost: true,
            stock: true,
            type: true,
            allergens: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
            phone: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        wasteLogs: {
          select: {
            id: true,
            quantity: true,
            totalCost: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    const now = new Date();
    const oneDayMs = 1000 * 60 * 60 * 24;

    // Filter by search if provided
    const filteredBatches = rawBatches.filter((b) => {
      if (!search) return true;
      const bNumber = b.batchNumber.toLowerCase();
      const ingName = b.ingredient.name.toLowerCase();
      const supName = b.supplier?.name.toLowerCase() || '';
      return bNumber.includes(search) || ingName.includes(search) || supName.includes(search);
    });

    // Compute FEFO priorities per ingredient (active batches with stock > 0)
    const fefoMap: Record<string, string> = {}; // ingredientId -> batchId of earliest expiration
    const activeWithStock = rawBatches
      .filter((b) => b.status === 'ACTIVE' && b.currentQuantity > 0)
      .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());

    for (const b of activeWithStock) {
      if (!fefoMap[b.ingredientId]) {
        fefoMap[b.ingredientId] = b.id;
      }
    }

    // Annotate batches
    let expiredCount = 0;
    let expiringSoon7Days = 0;
    let expiringSoon30Days = 0;
    let atRiskValue = 0;
    let totalActiveValue = 0;

    const batches = filteredBatches.map((b) => {
      const expTime = new Date(b.expirationDate).getTime();
      const daysRemaining = Math.ceil((expTime - now.getTime()) / oneDayMs);

      let urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'GOOD' = 'GOOD';
      if (daysRemaining <= 0) {
        urgency = 'EXPIRED';
      } else if (daysRemaining <= 7) {
        urgency = 'CRITICAL';
      } else if (daysRemaining <= 30) {
        urgency = 'WARNING';
      }

      const isFefoPick = fefoMap[b.ingredientId] === b.id;
      const batchValue = Math.round(b.currentQuantity * b.unitCost * 100) / 100;

      if (b.status === 'ACTIVE' && b.currentQuantity > 0) {
        totalActiveValue += batchValue;
        if (urgency === 'EXPIRED') {
          expiredCount++;
          atRiskValue += batchValue;
        } else if (urgency === 'CRITICAL') {
          expiringSoon7Days++;
          atRiskValue += batchValue;
        } else if (urgency === 'WARNING') {
          expiringSoon30Days++;
          atRiskValue += batchValue;
        }
      }

      return {
        ...b,
        daysRemaining,
        urgency,
        isFefoPick,
        batchValue,
      };
    });

    const stats = {
      totalBatches: batches.length,
      activeBatches: batches.filter((b) => b.status === 'ACTIVE' && b.currentQuantity > 0).length,
      expiredCount,
      expiringSoon7Days,
      expiringSoon30Days,
      atRiskValue: Math.round(atRiskValue * 100) / 100,
      totalActiveValue: Math.round(totalActiveValue * 100) / 100,
    };

    return NextResponse.json({
      success: true,
      batches,
      stats,
      fefoMap,
    });
  } catch (error: unknown) {
    console.error('Error fetching inventory batches:', error);
    return NextResponse.json({ error: 'Error al consultar lotes y caducidades' }, { status: 500 });
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

    const {
      ingredientId,
      batchNumber,
      initialQuantity,
      unitCost,
      expirationDate,
      receivedDate,
      supplierId,
      warehouseId,
      notes,
      addToStock = true,
    } = body;

    if (!ingredientId) {
      return NextResponse.json({ error: 'El insumo es requerido' }, { status: 400 });
    }

    const qty = parseFloat(initialQuantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'La cantidad inicial debe ser mayor a 0' }, { status: 400 });
    }

    if (!expirationDate) {
      return NextResponse.json({ error: 'La fecha de caducidad es requerida' }, { status: 400 });
    }

    const parsedExpDate = new Date(expirationDate);
    if (isNaN(parsedExpDate.getTime())) {
      return NextResponse.json({ error: 'Fecha de caducidad inválida' }, { status: 400 });
    }

    const ing = await prisma.ingredient.findFirst({
      where: { id: ingredientId, brandId: activeBrandId },
    });

    if (!ing) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
    }

    const parsedUnitCost = parseFloat(unitCost) >= 0 ? parseFloat(unitCost) : ing.cost;
    const parsedReceivedDate = receivedDate ? new Date(receivedDate) : new Date();

    // Auto-generate batch folio if not provided
    let finalBatchNumber = batchNumber?.trim();
    if (!finalBatchNumber) {
      const dateStr = parsedReceivedDate.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = ing.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ING';
      const rand = Math.floor(100 + Math.random() * 900);
      finalBatchNumber = `LOT-${dateStr}-${prefix}-${rand}`;
    }

    // Atomic transaction for batch creation & stock sync
    const result = await prisma.$transaction(async (tx) => {
      // Create batch
      const newBatch = await tx.ingredientBatch.create({
        data: {
          brandId: activeBrandId,
          ingredientId: ing.id,
          batchNumber: finalBatchNumber,
          initialQuantity: qty,
          currentQuantity: qty,
          unitCost: parsedUnitCost,
          expirationDate: parsedExpDate,
          receivedDate: parsedReceivedDate,
          supplierId: supplierId || null,
          warehouseId: warehouseId || null,
          status: 'ACTIVE',
          notes: notes?.trim() || null,
        },
        include: {
          ingredient: true,
          supplier: true,
          warehouse: true,
        },
      });

      // Update Ingredient stock & PPP if requested
      if (addToStock) {
        const currentStock = Math.max(0, ing.stock);
        const currentCost = ing.cost || 0;
        const totalStock = currentStock + qty;
        const weightedCost = totalStock > 0 && parsedUnitCost > 0
          ? ((currentStock * currentCost) + (qty * parsedUnitCost)) / totalStock
          : currentCost;

        await tx.ingredient.update({
          where: { id: ing.id },
          data: {
            stock: { increment: qty },
            cost: Math.round(weightedCost * 10000) / 10000,
          },
        });

        // If warehouse specified, update warehouse stock
        if (warehouseId) {
          await tx.warehouseStock.upsert({
            where: {
              warehouseId_ingredientId: {
                warehouseId,
                ingredientId: ing.id,
              },
            },
            create: {
              warehouseId,
              ingredientId: ing.id,
              stock: qty,
            },
            update: {
              stock: { increment: qty },
            },
          });
        }
      }

      return newBatch;
    });

    await recordAuditLog({
      action: 'BATCH_CREATED',
      entityType: 'INGREDIENT_BATCH',
      entityId: result.id,
      details: {
        batchNumber: result.batchNumber,
        ingredientName: ing.name,
        quantity: qty,
        expirationDate: result.expirationDate,
        unitCost: parsedUnitCost,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, batch: result });
  } catch (error: unknown) {
    console.error('Error creating ingredient batch:', error);
    return NextResponse.json({ error: 'Error al registrar el lote' }, { status: 500 });
  }
}
