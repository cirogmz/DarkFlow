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

    const requisition = await prisma.internalRequisition.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        requestedBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
        dispatchedBy: { select: { id: true, name: true, role: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, cost: true, stock: true },
            },
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json(
        { error: 'Requisición no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(requisition);
  } catch (error: any) {
    console.error('Error fetching requisition details:', error);
    return NextResponse.json(
      { error: 'Error al consultar detalle de requisición', details: error.message },
      { status: 500 }
    );
  }
}
