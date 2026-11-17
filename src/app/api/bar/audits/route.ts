import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { 
  reconcileBarAudit, 
  generateBarAuditThermalTicket,
  BarShiftType, 
  BarAuditItemInput 
} from '@/lib/barAudit';
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
    const station = searchParams.get('station');
    const shift = searchParams.get('shift');

    const where: Record<string, unknown> = {
      brandId: activeBrandId,
    };

    if (station && station !== 'ALL') where.station = station;
    if (shift && shift !== 'ALL') where.shift = shift;

    const audits = await prisma.barLiquorAudit.findMany({
      where,
      include: {
        items: {
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Métricas globales acumuladas
    const totalLossAmount = audits.reduce((sum, a) => sum + a.financialLossAmount, 0);
    const totalVarianceMl = audits.reduce((sum, a) => sum + a.varianceMl, 0);
    const totalCocktails = audits.reduce((sum, a) => sum + a.totalCocktailsSold, 0);
    const discrepanciesCount = audits.filter((a) => a.status === 'DISCREPANCY_FLAGGED').length;

    return NextResponse.json({
      audits,
      metrics: {
        totalAudits: audits.length,
        totalLossAmount: Math.round(totalLossAmount * 100) / 100,
        totalVarianceMl: Math.round(totalVarianceMl * 10) / 10,
        totalCocktails,
        discrepanciesCount,
      },
    });
  } catch (error: any) {
    console.error('Error al consultar auditorías de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
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
      station = 'Barra Principal',
      shift = 'TURNO_COMPLETO',
      periodStart,
      periodEnd,
      auditedByName,
      notes,
      items,
      saveAudit = true,
      syncBottleInventory = true,
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debes incluir al menos una botella en la auditoría' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    const pStart = periodStart ? new Date(periodStart) : new Date(Date.now() - 12 * 60 * 60 * 1000);
    const pEnd = periodEnd ? new Date(periodEnd) : new Date();

    // 1. Ejecutar motor de reconciliación comanda vs botella
    const auditResult = await reconcileBarAudit({
      brandId: activeBrandId,
      station,
      shift: shift as BarShiftType,
      periodStart: pStart,
      periodEnd: pEnd,
      items: items as BarAuditItemInput[],
    });

    // Si solo es previsualización (simulación)
    if (!saveAudit) {
      return NextResponse.json({
        success: true,
        auditResult,
      });
    }

    // 2. Generar folio correlativo BAR-YYYYMM-XXX
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const count = await prisma.barLiquorAudit.count({
      where: {
        brandId: activeBrandId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });
    const folio = `BAR-${yearMonth}-${String(count + 1).padStart(3, '0')}`;

    // 3. Persistir en transacción atómica
    const saved = await prisma.$transaction(async (tx) => {
      const createdAudit = await tx.barLiquorAudit.create({
        data: {
          folio,
          brandId: activeBrandId,
          station,
          shift,
          periodStart: pStart,
          periodEnd: pEnd,
          auditedById: session.userId || null,
          auditedByName: auditedByName || session.name || 'Capitán de Barra',
          status: auditResult.status,
          totalCocktailsSold: auditResult.totalCocktailsSold,
          totalTheoreticalMl: auditResult.totalTheoreticalMl,
          totalActualMl: auditResult.totalActualMl,
          varianceMl: auditResult.varianceMl,
          overPourPercentage: auditResult.overPourPercentage,
          financialLossAmount: auditResult.financialLossAmount,
          notes: notes || null,
          items: {
            create: auditResult.items.map((i) => ({
              ingredientId: i.ingredientId,
              bottleLabel: i.bottleLabel,
              bottleCapacityMl: i.bottleCapacityMl,
              costPerMl: i.costPerMl,
              startLevelMl: i.startLevelMl,
              endLevelMl: i.endLevelMl,
              newBottlesAddedMl: i.newBottlesAddedMl,
              actualPouredMl: i.actualPouredMl,
              theoreticalPouredMl: i.theoreticalPouredMl,
              cocktailsSoldCount: i.cocktailsSoldCount,
              varianceMl: i.varianceMl,
              variancePercentage: i.variancePercentage,
              financialVariance: i.financialVariance,
              shrinkageReason: i.shrinkageReason,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Sincronizar nivel en BarBottle si está activo
      if (syncBottleInventory) {
        for (const item of auditResult.items) {
          const matchingBottle = await tx.barBottle.findFirst({
            where: {
              brandId: activeBrandId,
              station,
              ingredientId: item.ingredientId,
              status: 'OPEN',
            },
          });

          if (matchingBottle) {
            const nextStatus = item.endLevelMl <= 5 ? 'EMPTY' : 'OPEN';
            await tx.barBottle.update({
              where: { id: matchingBottle.id },
              data: {
                currentMl: item.endLevelMl,
                status: nextStatus,
              },
            });
          }
        }
      }

      return createdAudit;
    });

    // 4. Generar Ticket Térmico ESC/POS
    const thermalTicket = generateBarAuditThermalTicket({
      brandName: brand.name,
      folio: saved.folio,
      audit: auditResult,
      auditorName: saved.auditedByName || 'Capitán de Barra',
    });

    // 5. Registrar en AuditLog
    await recordAuditLog({
      action: 'INVENTORY_AUDIT_APPROVED',
      entityType: 'INVENTORY_AUDIT',
      entityId: saved.id,
      details: {
        folio: saved.folio,
        station: saved.station,
        shift: saved.shift,
        totalLossAmount: saved.financialLossAmount,
        overPourPercentage: saved.overPourPercentage,
        status: saved.status,
      },
      severity: saved.status === 'DISCREPANCY_FLAGGED' ? 'WARNING' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      audit: saved,
      thermalTicket,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error al guardar auditoría de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
