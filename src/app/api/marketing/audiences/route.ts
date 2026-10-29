import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getAudienceBySegment, getAudienceCounts } from '@/lib/marketing';
import { TargetSegment } from '@/lib/marketingConstants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || (session.activeBrandId as string | undefined) || '';
    const segment = (searchParams.get('segment') as TargetSegment) || 'ALL';

    const counts = await getAudienceCounts(brandId);
    const audienceList = await getAudienceBySegment(brandId, segment);

    // Limit preview sample to 50 for performance
    const sample = audienceList.slice(0, 50).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      tier: c.tier,
      walletBalance: c.walletBalance,
      totalSpent: c.totalSpent,
      totalOrders: c.totalOrders,
      birthDate: c.birthDate,
      lastOrderDate: c.orders[0]?.createdAt || null,
    }));

    return NextResponse.json({
      counts,
      activeSegment: segment,
      totalInSegment: audienceList.length,
      sample,
    });
  } catch (error: any) {
    console.error('Error fetching audience stats:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener audiencias' },
      { status: 500 }
    );
  }
}

