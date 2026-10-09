import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { brandId } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId es requerido' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: {
        isActive: !brand.isActive,
      },
    });

    await recordAuditLog({
      action: 'BRAND_STATUS_TOGGLED',
      entityType: 'BRAND',
      entityId: brand.id,
      severity: 'WARNING',
      details: `Marca "${brand.name}" ${updated.isActive ? 'ACTIVADA' : 'PAUSADA'} desde Mobile Owner Hub por ${session.email}`,
      brandId: brand.id,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, brand: updated });
  } catch (error) {
    console.error('Error toggling brand status:', error);
    return NextResponse.json({ error: 'Error al cambiar estado de la marca' }, { status: 500 });
  }
}
