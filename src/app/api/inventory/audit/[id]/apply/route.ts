import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
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
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const { notes: approvalNotes } = body;

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
        warehouse: true,
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

    // Generate unique Adjustment Folio
    const currentYear = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const adjustmentFolio = `AJU-${currentYear}-${randomSuffix}`;
    const now = new Date();

    // Aplicar ajustes en una transacción atómica
    const result = await prisma.$transaction(async (tx: any) => {
      let totalNegativeDiscrepancyCost = 0;
      let totalPositiveDiscrepancyCost = 0;

      for (const item of audit.items) {
        // 1. Ajustar el stock general del insumo al conteo físico real
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stock: item.countedStock,
          },
        });

        // 2. Si la auditoría fue en una bodega específica, ajustar WarehouseStock
        if (audit.warehouseId) {
          const existingWarehouseStock = await tx.warehouseStock.findFirst({
            where: {
              warehouseId: audit.warehouseId,
              ingredientId: item.ingredientId,
            },
          });

          if (existingWarehouseStock) {
            await tx.warehouseStock.update({
              where: { id: existingWarehouseStock.id },
              data: { stock: item.countedStock },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                warehouseId: audit.warehouseId,
                ingredientId: item.ingredientId,
                stock: item.countedStock,
              },
            });
          }
        }

        // 3. Si hubo faltante (merma oculta / robo hormiga), registrar en la bitácora de mermas
        if (item.discrepancy < 0) {
          const absDiscrepancyQty = Math.abs(item.discrepancy);
          const absDiscrepancyCost = Math.abs(item.discrepancyCost);
          totalNegativeDiscrepancyCost += absDiscrepancyCost;

          const reasonLabel = item.varianceType === 'THEFT_SUSPECT'
            ? `FALTANTE CRÍTICO / POSIBLE FUGA EN ARQUEO ${audit.auditNumber}`
            : `FALTANTE EN ARQUEO FÍSICO ${audit.auditNumber}`;

          await tx.wasteLog.create({
            data: {
              brandId: session.activeBrandId,
              ingredientId: item.ingredientId,
              quantity: absDiscrepancyQty,
              costPerUnit: item.unitCost,
              totalCost: absDiscrepancyCost,
              reason: reasonLabel,
              notes: item.notes || `Ajuste contable folio ${adjustmentFolio}. Diferencia: ${item.discrepancy} ${item.ingredient.unit}`,
              warehouseId: audit.warehouseId,
              userId: session.userId,
            },
          });
        } else if (item.discrepancy > 0) {
          totalPositiveDiscrepancyCost += item.discrepancyCost;
        }
      }

      // 4. Marcar auditoría como aplicada y aprobada
      const updatedAudit = await tx.inventoryAudit.update({
        where: { id: audit.id },
        data: {
          status: 'APPLIED',
          appliedAt: now,
          adjustmentFolio,
          approvedById: session.userId,
          approvedByName: session.name || 'Supervisor de Almacén',
          approvedAt: now,
          notes: approvalNotes ? `${audit.notes ? `${audit.notes} | ` : ''}Aprobación: ${approvalNotes}` : audit.notes,
        },
        include: {
          items: {
            include: {
              ingredient: true,
            },
          },
          warehouse: true,
          conductedBy: true,
        },
      });

      return {
        updatedAudit,
        totalNegativeDiscrepancyCost,
        totalPositiveDiscrepancyCost,
        adjustmentFolio,
      };
    });

    // 5. Registrar en Auditoría General Inmutable
    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'INVENTORY_AUDIT_APPLIED',
      entityType: 'INVENTORY_AUDIT',
      entityId: audit.id,
      severity: result.totalNegativeDiscrepancyCost > 500 ? 'CRITICAL' : 'WARNING',
      details: {
        auditNumber: audit.auditNumber,
        adjustmentFolio: result.adjustmentFolio,
        totalDiscrepancyValue: audit.totalDiscrepancyValue,
        totalNegativeDiscrepancyCost: result.totalNegativeDiscrepancyCost,
        totalPositiveDiscrepancyCost: result.totalPositiveDiscrepancyCost,
        warehouseName: audit.warehouse?.name || 'Almacén General',
        approvedBy: session.name,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Auditoría aplicada exitosamente con folio contable ${result.adjustmentFolio}`,
      adjustmentFolio: result.adjustmentFolio,
      audit: result.updatedAudit,
    });
  } catch (error: any) {
    console.error('Error applying inventory audit:', error);
    return NextResponse.json(
      { error: 'Error al aplicar ajustes de inventario', details: error.message },
      { status: 500 }
    );
  }
}
