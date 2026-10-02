import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';

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

    const audit = await prisma.inventoryAudit.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    if (audit.status === 'APPLIED') {
      return NextResponse.json(
        { error: 'Esta auditoría ya fue aplicada anteriormente a las existencias' },
        { status: 400 }
      );
    }

    // Aplicar ajustes en una transacción atómica
    const result = await prisma.$transaction(async (tx: any) => {
      let totalNegativeDiscrepancyCost = 0;

      for (const item of audit.items) {
        // 1. Ajustar el stock del insumo al conteo físico real
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stock: item.countedStock,
          },
        });

        // 2. Si hubo faltante (merma oculta / robo hormiga), registrar en la bitácora de mermas
        if (item.discrepancy < 0) {
          const absDiscrepancyQty = Math.abs(item.discrepancy);
          const absDiscrepancyCost = Math.abs(item.discrepancyCost);
          totalNegativeDiscrepancyCost += absDiscrepancyCost;

          await tx.wasteLog.create({
            data: {
              brandId: session.activeBrandId,
              ingredientId: item.ingredientId,
              quantity: absDiscrepancyQty,
              costPerUnit: item.unitCost,
              totalCost: absDiscrepancyCost,
              reason: `FALTANTE EN AUDITORÍA FÍSICA ${audit.auditNumber}`,
              notes: item.notes || `Ajuste automático por diferencia de ${item.discrepancy} ${item.ingredient.unit}`,
              warehouseId: audit.warehouseId,
              userId: session.userId,
            },
          });
        }
      }

      // 3. Marcar auditoría como aplicada
      const updatedAudit = await tx.inventoryAudit.update({
        where: { id: audit.id },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
        },
        include: {
          items: {
            include: {
              ingredient: true,
            },
          },
        },
      });

      // 4. Registrar en Auditoría del Sistema
      await tx.auditLog.create({
        data: {
          brandId: session.activeBrandId,
          userId: session.userId,
          action: 'INVENTORY_AUDIT_APPLIED',
          entityType: 'INVENTORY_AUDIT',
          entityId: audit.id,
          severity: totalNegativeDiscrepancyCost > 500 ? 'CRITICAL' : 'WARNING',
          details: `Auditoría física ${audit.auditNumber} aplicada a existencias por ${session.name}. Descuadre neto: $${audit.totalDiscrepancyValue.toFixed(2)}. Faltantes mermados: $${totalNegativeDiscrepancyCost.toFixed(2)}.`,
        },
      });

      return updatedAudit;
    });

    return NextResponse.json({
      message: 'Auditoría aplicada exitosamente a las existencias de inventario',
      audit: result,
    });
  } catch (error: any) {
    console.error('Error applying inventory audit:', error);
    return NextResponse.json(
      { error: 'Error al aplicar ajustes de inventario', details: error.message },
      { status: 500 }
    );
  }
}
