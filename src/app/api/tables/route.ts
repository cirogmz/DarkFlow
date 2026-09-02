import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const tables = await prisma.table.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        orders: {
          where: {
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { zone: 'asc' },
        { number: 'asc' },
      ],
    });

    return NextResponse.json({ tables });
  } catch (error: unknown) {
    console.error('Error fetching tables:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes para crear mesas' }, { status: 403 });
    }

    const { number, name, capacity, zone } = await req.json();

    if (!number || typeof number !== 'string' || number.trim().length === 0) {
      return NextResponse.json({ error: 'El número o código de mesa es requerido' }, { status: 400 });
    }

    const tableNumber = number.trim();

    // Check unique number per brand
    const existing = await prisma.table.findUnique({
      where: {
        number_brandId: {
          number: tableNumber,
          brandId: session.activeBrandId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Ya existe la mesa ${tableNumber} en esta cocina/salón` }, { status: 400 });
    }

    const table = await prisma.table.create({
      data: {
        number: tableNumber,
        name: name ? name.trim() : `Mesa ${tableNumber}`,
        capacity: capacity ? parseInt(capacity, 10) : 4,
        zone: zone ? zone.trim() : 'Salón',
        brandId: session.activeBrandId,
        status: 'AVAILABLE',
      },
    });

    return NextResponse.json({ success: true, table });
  } catch (error: unknown) {
    console.error('Error creating table:', error);
    return NextResponse.json({ error: 'Error al crear mesa' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, status, name, capacity, zone, action } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de mesa requerido' }, { status: 400 });
    }

    const existing = await prisma.table.findUnique({
      where: { id },
    });

    if (!existing || existing.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Mesa no encontrada o no autorizada' }, { status: 404 });
    }

    // Quick action: release table (mark active orders as delivered if any, set table available)
    if (action === 'release') {
      await prisma.$transaction(async (tx) => {
        await tx.table.update({
          where: { id },
          data: { status: 'AVAILABLE' },
        });

        // Close any active orders linked to this table
        await tx.order.updateMany({
          where: {
            tableId: id,
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          data: {
            status: 'DELIVERED',
          },
        });
      });

      return NextResponse.json({ success: true, released: true });
    }

    const updated = await prisma.table.update({
      where: { id },
      data: {
        status: status !== undefined ? status : undefined,
        name: name !== undefined ? name.trim() : undefined,
        capacity: capacity !== undefined ? parseInt(capacity, 10) : undefined,
        zone: zone !== undefined ? zone.trim() : undefined,
      },
    });

    return NextResponse.json({ success: true, table: updated });
  } catch (error: unknown) {
    console.error('Error updating table:', error);
    return NextResponse.json({ error: 'Error al actualizar mesa' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('id');

    if (!tableId) {
      return NextResponse.json({ error: 'ID de mesa requerido' }, { status: 400 });
    }

    const existing = await prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!existing || existing.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Mesa no encontrada o no autorizada' }, { status: 404 });
    }

    if (existing.status === 'OCCUPIED' || existing.status === 'BILL_REQUESTED') {
      return NextResponse.json({ error: 'No puedes eliminar una mesa ocupada con comensales' }, { status: 400 });
    }

    await prisma.table.delete({
      where: { id: tableId },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: unknown) {
    console.error('Error deleting table:', error);
    return NextResponse.json({ error: 'Error al eliminar mesa' }, { status: 500 });
  }
}
