import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const brandId = session.activeBrandId;

    const deliveryOrders = await prisma.order.findMany({
      where: {
        brandId,
        source: {
          in: ['UBER_EATS', 'RAPPI', 'DIDI_FOOD'],
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Compute metrics by platform
    const platformStats: Record<string, { count: number; grossSales: number; commissions: number; netPayout: number }> = {
      UBER_EATS: { count: 0, grossSales: 0, commissions: 0, netPayout: 0 },
      RAPPI: { count: 0, grossSales: 0, commissions: 0, netPayout: 0 },
      DIDI_FOOD: { count: 0, grossSales: 0, commissions: 0, netPayout: 0 },
    };

    let totalGrossSales = 0;
    let totalCommissions = 0;
    let totalNetPayout = 0;

    for (const order of deliveryOrders) {
      const p = order.source;
      if (!platformStats[p]) {
        platformStats[p] = { count: 0, grossSales: 0, commissions: 0, netPayout: 0 };
      }

      const commission = order.platformCommission ?? ((order.total * (order.platformCommissionRate || 25)) / 100);
      const net = order.netPayout ?? (order.total - commission);

      platformStats[p].count += 1;
      platformStats[p].grossSales += order.total;
      platformStats[p].commissions += commission;
      platformStats[p].netPayout += net;

      totalGrossSales += order.total;
      totalCommissions += commission;
      totalNetPayout += net;
    }

    return NextResponse.json({
      orders: deliveryOrders,
      metrics: {
        totalOrders: deliveryOrders.length,
        totalGrossSales: parseFloat(totalGrossSales.toFixed(2)),
        totalCommissions: parseFloat(totalCommissions.toFixed(2)),
        totalNetPayout: parseFloat(totalNetPayout.toFixed(2)),
        effectiveCommissionPercent: totalGrossSales > 0 ? parseFloat(((totalCommissions / totalGrossSales) * 100).toFixed(1)) : 0,
        byPlatform: platformStats,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching delivery metrics:', error);
    return NextResponse.json({ error: 'Error al obtener métricas de delivery' }, { status: 500 });
  }
}
