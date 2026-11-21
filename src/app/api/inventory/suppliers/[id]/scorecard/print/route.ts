import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateVendorScorecardTicket } from '@/lib/vendorScorecard';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;

    const supplier = await prisma.supplier.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        brand: { select: { name: true } },
        _count: {
          select: { incidents: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const ticket = generateVendorScorecardTicket({
      supplierName: supplier.name,
      supplierCode: supplier.code,
      overallScore: supplier.overallScore ?? 100,
      ratingTier: supplier.ratingTier ?? 'A',
      totalOrders: supplier.totalOrdersDelivered ?? 0,
      otifRatePct: supplier.otifRatePct ?? 100,
      onTimeDeliveries: supplier.onTimeDeliveries ?? 0,
      inFullDeliveries: supplier.inFullDeliveries ?? 0,
      otifDeliveries: supplier.otifDeliveries ?? 0,
      avgPriceVariancePct: supplier.avgPriceVariancePct ?? 0,
      incidentsCount: supplier._count.incidents,
      brandName: supplier.brand?.name,
    });

    return NextResponse.json({
      success: true,
      ticket,
      supplierName: supplier.name,
      ratingTier: supplier.ratingTier ?? 'A',
      overallScore: supplier.overallScore ?? 100,
    });
  } catch (error: unknown) {
    console.error('Error generating printable vendor scorecard:', error);
    return NextResponse.json({ error: 'Error al generar ticket de auditoría' }, { status: 500 });
  }
}
