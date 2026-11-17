import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const audit = await prisma.barLiquorAudit.findUnique({
      where: { id },
      include: {
        brand: {
          select: { name: true },
        },
        items: {
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                cost: true,
              },
            },
          },
        },
      },
    });

    if (!audit || audit.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Auditoría no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ audit });
  } catch (error: any) {
    console.error('Error al obtener detalle de auditoría de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const audit = await prisma.barLiquorAudit.findUnique({
      where: { id },
    });

    if (!audit || audit.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Auditoría no encontrada' }, { status: 404 });
    }

    await prisma.barLiquorAuditItem.deleteMany({
      where: { auditId: id },
    });

    await prisma.barLiquorAudit.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Auditoría ${audit.folio} eliminada`,
    });
  } catch (error: any) {
    console.error('Error al eliminar auditoría de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
