import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const suppliers = await prisma.supplier.findMany({
      where: { brandId: activeBrandId, isActive: true },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            incidents: true,
            batches: true,
          },
        },
        incidents: {
          select: {
            id: true,
            severity: true,
            incidentType: true,
            resolution: true,
            financialImpact: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [
        { overallScore: 'desc' },
        { totalOrdersDelivered: 'desc' },
      ],
    });

    // Summary KPIs across all suppliers
    let totalOrdersDelivered = 0;
    let totalOnTime = 0;
    let totalInFull = 0;
    let totalOtif = 0;
    let sumVariance = 0;
    let totalIncidentsCount = 0;

    const tierBreakdown = { A: 0, B: 0, C: 0, D: 0 };

    for (const sup of suppliers) {
      const delivered = sup.totalOrdersDelivered || 0;
      totalOrdersDelivered += delivered;
      totalOnTime += sup.onTimeDeliveries || 0;
      totalInFull += sup.inFullDeliveries || 0;
      totalOtif += sup.otifDeliveries || 0;
      sumVariance += (sup.avgPriceVariancePct || 0) * delivered;
      totalIncidentsCount += sup._count.incidents;

      const tier = (sup.ratingTier as 'A' | 'B' | 'C' | 'D') || 'A';
      if (tierBreakdown[tier] !== undefined) {
        tierBreakdown[tier]++;
      }
    }

    const globalOtifRatePct = totalOrdersDelivered > 0
      ? Math.round((totalOtif / totalOrdersDelivered) * 10000) / 100
      : 100;

    const globalAvgPriceVariancePct = totalOrdersDelivered > 0
      ? Math.round((sumVariance / totalOrdersDelivered) * 100) / 100
      : 0;

    return NextResponse.json({
      success: true,
      suppliers,
      kpis: {
        totalSuppliers: suppliers.length,
        totalOrdersDelivered,
        globalOtifRatePct,
        onTimeRatePct: totalOrdersDelivered > 0 ? Math.round((totalOnTime / totalOrdersDelivered) * 10000) / 100 : 100,
        inFullRatePct: totalOrdersDelivered > 0 ? Math.round((totalInFull / totalOrdersDelivered) * 10000) / 100 : 100,
        globalAvgPriceVariancePct,
        totalIncidentsCount,
        tierBreakdown,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching vendor scorecards:', error);
    return NextResponse.json({ error: 'Error al obtener el scorecard de proveedores' }, { status: 500 });
  }
}
