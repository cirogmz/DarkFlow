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
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    const where: Prisma.SatisfactionSurveyWhereInput = {};

    if (brandId && session.role !== 'SUPER_ADMIN') {
      where.brandId = brandId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
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

    // 1. Fetch surveys for the table
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

    // 2. Fetch all surveys for aggregated metrics (scoped to brand and date range)
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
        status: true,
      },
    });

    const stats = calculateNPSSummary(allScopedSurveys);
    const pendingDetractorsCount = allScopedSurveys.filter(
      (s) => s.status === 'PENDING_RESOLUTION'
    ).length;

    return NextResponse.json({
      surveys,
      stats,
      pendingDetractorsCount,
    });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: 'Error al consultar encuestas' }, { status: 500 });
  }
}
