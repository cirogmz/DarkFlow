import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cupón no encontrado' }, { status: 404 });
    }

    // Prepare update data
    const updateData: {
      isActive?: boolean;
      description?: string | null;
      discountValue?: number;
      minOrderAmount?: number;
      maxDiscount?: number | null;
      usageLimit?: number | null;
      startDate?: Date | null;
      endDate?: Date | null;
    } = {};

    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (typeof body.description !== 'undefined') updateData.description = body.description ? String(body.description).trim() : null;
    if (typeof body.discountValue !== 'undefined') updateData.discountValue = parseFloat(String(body.discountValue));
    if (typeof body.minOrderAmount !== 'undefined') updateData.minOrderAmount = parseFloat(String(body.minOrderAmount));
    if (typeof body.maxDiscount !== 'undefined') updateData.maxDiscount = body.maxDiscount ? parseFloat(String(body.maxDiscount)) : null;
    if (typeof body.usageLimit !== 'undefined') updateData.usageLimit = body.usageLimit ? parseInt(String(body.usageLimit), 10) : null;
    if (typeof body.startDate !== 'undefined') updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (typeof body.endDate !== 'undefined') updateData.endDate = body.endDate ? new Date(body.endDate) : null;

    const updated = await prisma.coupon.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, coupon: updated });
  } catch (error: unknown) {
    console.error('Error updating coupon:', error);
    return NextResponse.json({ error: 'Error al actualizar cupón' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.coupon.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Cupón eliminado' });
  } catch (error: unknown) {
    console.error('Error deleting coupon:', error);
    return NextResponse.json({ error: 'Error al eliminar cupón' }, { status: 500 });
  }
}
