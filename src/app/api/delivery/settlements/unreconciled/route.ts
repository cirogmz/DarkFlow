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
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: any = {
      brandId: activeBrandId,
      source: { in: ['UBER_EATS', 'RAPPI', 'DIDI_FOOD'] },
      reconciliationStatus: 'UNRECONCILED',
    };

    if (platform && platform !== 'ALL') {
      whereClause.source = platform;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let totalGross = 0;
    let totalEstimatedCommission = 0;
    let totalEstimatedNet = 0;

    for (const o of orders) {
      totalGross += o.total;
      const rate = o.platformCommissionRate || (o.source === 'UBER_EATS' ? 28 : o.source === 'RAPPI' ? 25 : 22);
      const comm = o.platformCommission ?? parseFloat(((o.total * rate) / 100).toFixed(2));
      const net = o.netPayout ?? parseFloat((o.total - comm).toFixed(2));
      totalEstimatedCommission += comm;
      totalEstimatedNet += net;
    }

    return NextResponse.json({
      orders,
      summary: {
        count: orders.length,
        totalGross: parseFloat(totalGross.toFixed(2)),
        totalEstimatedCommission: parseFloat(totalEstimatedCommission.toFixed(2)),
        totalEstimatedNet: parseFloat(totalEstimatedNet.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching unreconciled delivery orders:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
