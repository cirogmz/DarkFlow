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

    const existing = await prisma.combo.findUnique({
      where: { id },
    });

    if (!existing || existing.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Combo no encontrado' }, { status: 404 });
    }

    const updateData: {
      name?: string;
      description?: string | null;
      price?: number;
      imageUrl?: string | null;
      isActive?: boolean;
    } = {};

    if (typeof body.name === 'string') updateData.name = body.name.trim();
    if (typeof body.description !== 'undefined') updateData.description = body.description ? String(body.description).trim() : null;
    if (typeof body.price !== 'undefined') updateData.price = parseFloat(String(body.price));
    if (typeof body.imageUrl !== 'undefined') updateData.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;

    const updated = await prisma.combo.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, combo: updated });
  } catch (error: unknown) {
    console.error('Error updating combo:', error);
    return NextResponse.json({ error: 'Error al actualizar combo' }, { status: 500 });
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

    const existing = await prisma.combo.findUnique({
      where: { id },
    });

    if (!existing || existing.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Combo no encontrado' }, { status: 404 });
    }

    await prisma.combo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Combo eliminado' });
  } catch (error: unknown) {
    console.error('Error deleting combo:', error);
    return NextResponse.json({ error: 'Error al eliminar combo' }, { status: 500 });
  }
}
