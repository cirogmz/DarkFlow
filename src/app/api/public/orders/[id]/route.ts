import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'ID de orden requerido' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
        table: {
          select: {
            number: true,
            name: true,
            zone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error fetching order tracking:', error);
    return NextResponse.json(
      { error: 'Error al consultar el pedido' },
      { status: 500 }
    );
  }
}
