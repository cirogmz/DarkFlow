import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
      select: {
        id: true,
        name: true,
        targetFoodCostPct: true,
        targetLaborCostPct: true,
        targetPrimeCostPct: true,
        targetDailySales: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      targetFoodCostPct: brand.targetFoodCostPct ?? 30,
      targetLaborCostPct: brand.targetLaborCostPct ?? 20,
      targetPrimeCostPct: brand.targetPrimeCostPct ?? 55,
      targetDailySales: brand.targetDailySales ?? 15000,
    });
  } catch (error: unknown) {
    console.error('Error fetching brand budget targets:', error);
    return NextResponse.json({ error: 'Error al consultar metas presupuestales' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const userId = session.userId as string;

    const body = await req.json();
    const { targetFoodCostPct, targetLaborCostPct, targetPrimeCostPct, targetDailySales } = body;

    const updateData: Record<string, number> = {};

    if (targetFoodCostPct !== undefined) {
      updateData.targetFoodCostPct = Math.max(0, Math.min(100, parseFloat(targetFoodCostPct)));
    }
    if (targetLaborCostPct !== undefined) {
      updateData.targetLaborCostPct = Math.max(0, Math.min(100, parseFloat(targetLaborCostPct)));
    }
    if (targetPrimeCostPct !== undefined) {
      updateData.targetPrimeCostPct = Math.max(0, Math.min(100, parseFloat(targetPrimeCostPct)));
    }
    if (targetDailySales !== undefined) {
      updateData.targetDailySales = Math.max(0, parseFloat(targetDailySales));
    }

    const updatedBrand = await prisma.brand.update({
      where: { id: activeBrandId },
      data: updateData,
      select: {
        id: true,
        name: true,
        targetFoodCostPct: true,
        targetLaborCostPct: true,
        targetPrimeCostPct: true,
        targetDailySales: true,
      },
    });

    await recordAuditLog({
      action: 'BRAND_BUDGET_UPDATED',
      entityType: 'BRAND',
      entityId: activeBrandId,
      brandId: activeBrandId,
      userId,
      severity: 'INFO',
      details: updateData,
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Metas presupuestales actualizadas con éxito',
      brand: updatedBrand,
    });
  } catch (error: unknown) {
    console.error('Error updating brand budget targets:', error);
    return NextResponse.json({ error: 'Error al actualizar metas presupuestales' }, { status: 500 });
  }
}
