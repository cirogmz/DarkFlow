import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const brandId = searchParams.get('brandId') || (session.activeBrandId as string | undefined);
    const filter = searchParams.get('filter'); // 'all', 'vip', 'recent'

    const whereClause: Prisma.CustomerWhereInput = {};

    // Filter by active brand if brandId provided or customer belongs to brand
    if (brandId && session.role !== 'SUPER_ADMIN') {
      whereClause.OR = [
        { brandId },
        { brandId: null },
      ];
    }

    if (q) {
      const searchTerms: Prisma.CustomerWhereInput[] = [
        { name: { contains: q } },
        { phone: { contains: q } },
      ];
      if (whereClause.OR) {
        whereClause.AND = [{ OR: searchTerms }];
      } else {
        whereClause.OR = searchTerms;
      }
    }

    if (filter === 'vip') {
      whereClause.totalOrders = { gte: 3 };
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        brand: {
          select: { id: true, name: true, primaryColor: true },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            brand: { select: { name: true } },
            items: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: filter === 'recent' ? { updatedAt: 'desc' } : { totalSpent: 'desc' },
    });

    // Compute stats
    const totalCustomers = await prisma.customer.count();
    const vipCount = await prisma.customer.count({
      where: { totalOrders: { gte: 3 } },
    });
    const aggregates = await prisma.customer.aggregate({
      _sum: {
        loyaltyPoints: true,
        totalSpent: true,
      },
      _avg: {
        totalSpent: true,
      },
    });

    return NextResponse.json({
      customers,
      stats: {
        totalCustomers,
        vipCustomers: vipCount,
        totalPoints: aggregates._sum.loyaltyPoints || 0,
        totalSpent: aggregates._sum.totalSpent || 0,
        averageSpent: aggregates._avg.totalSpent || 0,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await req.json();
    const { name, phone, email, address, notes, initialPoints = 0 } = data;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nombre y teléfono son obligatorios' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente registrado con este teléfono' }, { status: 409 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
        loyaltyPoints: parseInt(String(initialPoints), 10) || 0,
        brandId: session.activeBrandId || null,
      },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Error al registrar cliente' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await req.json();
    const { id, name, phone, email, address, notes, pointsAdjustment } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check phone uniqueness if changing
    if (phone && phone.trim() !== customer.phone) {
      const existingPhone = await prisma.customer.findUnique({
        where: { phone: phone.trim() },
      });
      if (existingPhone && existingPhone.id !== id) {
        return NextResponse.json({ error: 'El número de teléfono ya está registrado por otro cliente' }, { status: 409 });
      }
    }

    let updatedPoints = customer.loyaltyPoints;
    if (typeof pointsAdjustment === 'number') {
      updatedPoints = Math.max(0, updatedPoints + pointsAdjustment);
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name ? name.trim() : customer.name,
        phone: phone ? phone.trim() : customer.phone,
        email: email !== undefined ? (email ? email.trim() : null) : customer.email,
        address: address !== undefined ? (address ? address.trim() : null) : customer.address,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : customer.notes,
        loyaltyPoints: updatedPoints,
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: unknown) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado para eliminar clientes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    // Unlink orders before deleting customer if any
    await prisma.order.updateMany({
      where: { customerId: id },
      data: { customerId: null },
    });

    await prisma.customer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (error: unknown) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}
