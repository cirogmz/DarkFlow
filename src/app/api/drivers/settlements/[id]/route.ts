import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const settlement = await prisma.driverSettlement.findUnique({
      where: { id },
      include: {
        brand: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            deliveryProfile: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        orders: {
          include: {
            items: {
              include: {
                product: { select: { name: true } },
              },
            },
            customer: true,
          },
          orderBy: { deliveredAt: 'asc' },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    if (settlement.brandId !== session.activeBrandId && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ success: true, settlement });
  } catch (error: unknown) {
    console.error('Error fetching driver settlement by ID:', error);
    return NextResponse.json({ error: 'Error al consultar liquidación' }, { status: 500 });
  }
}
