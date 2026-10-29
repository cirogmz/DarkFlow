import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createCampaign } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || (session.activeBrandId as string | undefined);
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const triggerType = searchParams.get('triggerType');

    const where: any = {};
    if (brandId && brandId !== 'ALL' && session.role !== 'SUPER_ADMIN') {
      where.brandId = brandId;
    } else if (brandId && brandId !== 'ALL') {
      where.brandId = brandId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (channel && channel !== 'ALL') {
      where.channel = channel;
    }
    if (triggerType && triggerType !== 'ALL') {
      where.triggerType = triggerType;
    }

    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      include: {
        brand: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { recipients: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Calculate aggregated KPIs
    let totalSent = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    campaigns.forEach((c) => {
      totalSent += c.sentCount || 0;
      totalClicks += c.clicksCount || 0;
      totalConversions += c.conversionsCount || 0;
    });

    const conversionRatePct = totalSent > 0 ? (totalConversions / totalSent) * 100 : 0;

    return NextResponse.json({
      campaigns,
      kpis: {
        totalCampaigns: campaigns.length,
        totalSent,
        totalClicks,
        totalConversions,
        conversionRatePct: Number(conversionRatePct.toFixed(1)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching marketing campaigns:', error);
    return NextResponse.json(
      { error: error.message || 'Error al listar campañas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      brandId,
      channel,
      triggerType,
      targetSegment,
      subject,
      messageTemplate,
      couponCode,
      discountPct,
      walletBonusAmount,
      scheduledAt,
    } = body;

    const targetBrandId = brandId || session.activeBrandId;
    if (!targetBrandId) {
      return NextResponse.json({ error: 'La marca es requerida.' }, { status: 400 });
    }

    if (!name || !messageTemplate) {
      return NextResponse.json(
        { error: 'El nombre y la plantilla del mensaje son requeridos.' },
        { status: 400 }
      );
    }

    const result = await createCampaign({
      name,
      brandId: targetBrandId,
      channel,
      triggerType,
      targetSegment,
      subject,
      messageTemplate,
      couponCode,
      discountPct: discountPct ? Number(discountPct) : undefined,
      walletBonusAmount: walletBonusAmount ? Number(walletBonusAmount) : undefined,
      scheduledAt,
      createdById: session.userId,
      createdByName: session.name || session.email,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating marketing campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear campaña' },
      { status: 500 }
    );
  }
}

