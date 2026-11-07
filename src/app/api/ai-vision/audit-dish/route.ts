import { NextRequest, NextResponse } from 'next/server';
import { auditDishQuality } from '@/lib/aiVision';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64OrUrl, brandId, productId, orderId, station, auditedById, auditedByName } = body;

    if (!imageBase64OrUrl) {
      return NextResponse.json({ error: 'La fotografía del platillo es requerida' }, { status: 400 });
    }

    let effectiveBrandId = brandId;
    if (!effectiveBrandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ error: 'No se encontró una marca activa' }, { status: 400 });
      }
      effectiveBrandId = firstBrand.id;
    }

    const auditResult = await auditDishQuality({
      imageBase64OrUrl,
      brandId: effectiveBrandId,
      productId,
      orderId,
      station,
      auditedById,
      auditedByName,
    });

    return NextResponse.json({
      success: true,
      audit: auditResult,
    });
  } catch (error) {
    console.error('Error en /api/ai-vision/audit-dish:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al auditar el platillo con IA' },
      { status: 500 }
    );
  }
}
