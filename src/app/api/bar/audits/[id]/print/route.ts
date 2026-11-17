import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateBarAuditThermalTicket, BarShiftType } from '@/lib/barAudit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const audit = await prisma.barLiquorAudit.findUnique({
      where: { id },
      include: {
        brand: {
          select: { name: true },
        },
        items: {
          include: {
            ingredient: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!audit || audit.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Auditoría no encontrada' }, { status: 404 });
    }

    const ticket = generateBarAuditThermalTicket({
      brandName: audit.brand.name,
      folio: audit.folio,
      audit: {
        station: audit.station,
        shift: audit.shift as BarShiftType,
        periodStart: audit.periodStart,
        periodEnd: audit.periodEnd,
        totalCocktailsSold: audit.totalCocktailsSold,
        totalTheoreticalMl: audit.totalTheoreticalMl,
        totalActualMl: audit.totalActualMl,
        varianceMl: audit.varianceMl,
        overPourPercentage: audit.overPourPercentage,
        financialLossAmount: audit.financialLossAmount,
        status: audit.status as any,
        items: audit.items.map((i) => ({
          ingredientId: i.ingredientId,
          ingredientName: i.ingredient?.name || i.bottleLabel,
          bottleLabel: i.bottleLabel,
          bottleCapacityMl: i.bottleCapacityMl,
          costPerMl: i.costPerMl,
          startLevelMl: i.startLevelMl,
          newBottlesAddedMl: i.newBottlesAddedMl,
          endLevelMl: i.endLevelMl,
          actualPouredMl: i.actualPouredMl,
          theoreticalPouredMl: i.theoreticalPouredMl,
          cocktailsSoldCount: i.cocktailsSoldCount,
          varianceMl: i.varianceMl,
          variancePercentage: i.variancePercentage,
          financialVariance: i.financialVariance,
          shrinkageReason: i.shrinkageReason as any,
          notes: i.notes || undefined,
        })),
      },
      auditorName: audit.auditedByName || 'Capitán de Barra',
    });

    return NextResponse.json({
      success: true,
      folio: audit.folio,
      ticketText: ticket,
    });
  } catch (error: any) {
    console.error('Error al generar ticket térmico de auditoría de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
