import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { calculateNPSSummary } from '@/lib/surveys';

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
    const status = searchParams.get('status'); // 'ALL' | 'PENDING_RESOLUTION' | 'RESOLVED'
    const npsCategory = searchParams.get('npsCategory'); // 'ALL' | 'PROMOTER' | 'PASSIVE' | 'DETRACTOR'
    const compensationFilter = searchParams.get('compensationType'); // 'ALL' | 'WALLET_CREDIT' | 'COUPON' | 'NONE'
    const waiterId = searchParams.get('waiterId');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 300);

    const where: Prisma.SatisfactionSurveyWhereInput = {};

    if (brandId && session.role !== 'SUPER_ADMIN') {
      where.brandId = brandId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (waiterId && waiterId !== 'ALL') {
      where.waiterId = waiterId;
    }

    if (compensationFilter && compensationFilter !== 'ALL') {
      if (compensationFilter === 'NONE') {
        where.OR = [
          { compensationType: 'NONE' },
          { compensationType: null },
        ];
      } else {
        where.compensationType = compensationFilter;
      }
    }

    if (npsCategory && npsCategory !== 'ALL') {
      if (npsCategory === 'PROMOTER') {
        where.npsScore = { gte: 9 };
      } else if (npsCategory === 'PASSIVE') {
        where.npsScore = { gte: 7, lte: 8 };
      } else if (npsCategory === 'DETRACTOR') {
        where.npsScore = { lte: 6 };
      }
    }

    if (minRating || maxRating) {
      where.overallRating = {};
      if (minRating) where.overallRating.gte = Number(minRating);
      if (maxRating) where.overallRating.lte = Number(maxRating);
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 1. Fetch surveys list
    const surveys = await prisma.satisfactionSurvey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            source: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            tier: true,
            walletBalance: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 2. Fetch all surveys for global stats and waiter ranking
    const statsWhere: Prisma.SatisfactionSurveyWhereInput = {};
    if (brandId && session.role !== 'SUPER_ADMIN') {
      statsWhere.brandId = brandId;
    }
    if (where.createdAt) {
      statsWhere.createdAt = where.createdAt;
    }

    const allScopedSurveys = await prisma.satisfactionSurvey.findMany({
      where: statsWhere,
      select: {
        overallRating: true,
        npsScore: true,
        foodRating: true,
        serviceRating: true,
        speedRating: true,
        cleanlinessRating: true,
        compensationAmount: true,
        compensationType: true,
        waiterId: true,
        waiterName: true,
        status: true,
      },
    });

    const stats = calculateNPSSummary(allScopedSurveys);
    const pendingDetractorsCount = allScopedSurveys.filter(
      (s) => s.status === 'PENDING_RESOLUTION'
    ).length;

    // 3. Aggregate ranking by waiter
    const waiterMap = new Map<string, {
      waiterId: string;
      waiterName: string;
      totalSurveys: number;
      sumRating: number;
      sumService: number;
      count5Stars: number;
    }>();

    for (const s of allScopedSurveys) {
      if (s.waiterId && s.waiterName) {
        const curr = waiterMap.get(s.waiterId) || {
          waiterId: s.waiterId,
          waiterName: s.waiterName,
          totalSurveys: 0,
          sumRating: 0,
          sumService: 0,
          count5Stars: 0,
        };
        curr.totalSurveys++;
        curr.sumRating += s.overallRating;
        curr.sumService += s.serviceRating || s.overallRating;
        if (s.overallRating === 5) curr.count5Stars++;
        waiterMap.set(s.waiterId, curr);
      }
    }

    const waiterRanking = Array.from(waiterMap.values())
      .map((w) => ({
        waiterId: w.waiterId,
        waiterName: w.waiterName,
        totalSurveys: w.totalSurveys,
        avgRating: Number((w.sumRating / w.totalSurveys).toFixed(1)),
        avgServiceRating: Number((w.sumService / w.totalSurveys).toFixed(1)),
        csatPct: Math.round((w.count5Stars / w.totalSurveys) * 100),
      }))
      .sort((a, b) => b.avgRating - a.avgRating);

    return NextResponse.json({
      surveys,
      stats,
      pendingDetractorsCount,
      waiterRanking,
    });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: 'Error al consultar encuestas' }, { status: 500 });
  }
}
