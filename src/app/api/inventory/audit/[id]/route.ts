import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';

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

    const audit = await prisma.inventoryAudit.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
      include: {
        warehouse: true,
        conductedBy: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true, cost: true, stock: true } },
          },
          orderBy: { discrepancyCost: 'asc' },
        },
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(audit);
  } catch (error: any) {
    console.error('Error fetching audit details:', error);
    return NextResponse.json(
      { error: 'Error al consultar auditoría', details: error.message },
      { status: 500 }
    );
  }
}
