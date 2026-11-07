import { NextRequest, NextResponse } from 'next/server';
import { getAiVisionStats } from '@/lib/aiVision';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandIdParam = searchParams.get('brandId');
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const passedFilter = searchParams.get('passed');

    let brandId = brandIdParam;
    if (!brandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ audits: [], stats: null, recentWasteWithAi: [] });
      }
      brandId = firstBrand.id;
    }

    const effectiveBrandId = brandId as string;
    const whereClause: { brandId: string; passed?: boolean } = { brandId: effectiveBrandId };
    if (passedFilter !== null && passedFilter !== undefined && passedFilter !== '') {
      whereClause.passed = passedFilter === 'true';
    }

    const [audits, stats, recentWasteWithAi] = await Promise.all([
      prisma.dishQualityAudit.findMany({
        where: whereClause,
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true },
          },
          order: {
            select: { id: true, orderNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      getAiVisionStats(effectiveBrandId),
      prisma.wasteLog.findMany({
        where: { brandId: effectiveBrandId, aiAnalyzed: true },
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      audits,
      stats,
      recentWasteWithAi,
    });
  } catch (error) {
    console.error('Error en /api/ai-vision/audits:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener auditorías de visión IA' },
      { status: 500 }
    );
  }
}
