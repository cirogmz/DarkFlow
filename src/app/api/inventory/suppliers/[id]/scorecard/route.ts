import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
        _count: {
          select: {
            purchaseOrders: true,
            incidents: true,
            batches: true,
          },
        },
        incidents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Historical purchase orders with OTIF metrics
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        brandId: activeBrandId,
        supplierId: id,
        status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED', 'SENT'] },
      },
      include: {
        items: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
        deliveryIncidents: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      supplier,
      purchaseOrders,
    });
  } catch (error: unknown) {
    console.error('Error fetching individual supplier scorecard:', error);
    return NextResponse.json({ error: 'Error al obtener la auditoría del proveedor' }, { status: 500 });
  }
}
