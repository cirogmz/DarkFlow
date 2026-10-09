import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/hash';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandFilter = session.activeBrandId && session.role !== 'SUPER_ADMIN'
      ? {
          OR: [
            { brands: { some: { brandId: session.activeBrandId } } },
            { brands: { none: {} } }, // Fallback for globally created drivers
          ],
        }
      : {};

    const drivers = await prisma.user.findMany({
      where: {
        role: 'DELIVERY',
        ...brandFilter,
      },
      include: {
        deliveryProfile: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get active statistics for each driver in the current brand
    const activeBrandId = session.activeBrandId;
    const enrichedDrivers = await Promise.all(
      drivers.map(async (driver) => {
        const orderWhereBase = {
          driverId: driver.id,
          ...(activeBrandId ? { brandId: activeBrandId } : {}),
        };

        const activeDeliveriesCount = await prisma.order.count({
          where: {
            ...orderWhereBase,
            status: 'ON_THE_WAY',
          },
        });

        const pendingOrders = await prisma.order.findMany({
          where: {
            ...orderWhereBase,
            status: 'DELIVERED',
            driverSettled: false,
          },
          select: {
            id: true,
            total: true,
            tip: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        });

        const pendingSettlementOrdersCount = pendingOrders.length;
        const pendingSettlementCash = pendingOrders
          .filter((o) => !o.paymentMethod || o.paymentMethod.toUpperCase().includes('CASH') || o.paymentMethod.toUpperCase().includes('EFECTIVO'))
          .reduce((sum, o) => sum + o.total, 0);
        const pendingSettlementTips = pendingOrders.reduce((sum, o) => sum + (o.tip || 0), 0);

        return {
          ...driver,
          stats: {
            activeDeliveriesCount,
            pendingSettlementOrdersCount,
            pendingSettlementCash,
            pendingSettlementTips,
          },
        };
      })
    );

    return NextResponse.json({ drivers: enrichedDrivers });
  } catch (error: unknown) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      driverId, 
      status, 
      vehicleType, 
      plateNumber, 
      phoneNumber, 
      activeCashFloat, 
      commissionPerOrder,
      createNew,
      name,
      email,
      password 
    } = body;

    // Creation of a new driver
    if (createNew) {
      if (!name || !email) {
        return NextResponse.json({ error: 'Nombre y correo son requeridos para nuevo chofer' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese correo electrónico' }, { status: 400 });
      }

      const passwordHash = hashPassword(password || 'darkflow123');
      const newDriver = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'DELIVERY',
          brands: session.activeBrandId
            ? {
                create: { brandId: session.activeBrandId },
              }
            : undefined,
          deliveryProfile: {
            create: {
              status: status || 'AVAILABLE',
              vehicleType: vehicleType || 'MOTO',
              plateNumber: plateNumber || '',
              phoneNumber: phoneNumber || '',
              activeCashFloat: typeof activeCashFloat === 'number' ? activeCashFloat : 0,
              commissionPerOrder: typeof commissionPerOrder === 'number' ? commissionPerOrder : 0,
            },
          },
        },
        include: {
          deliveryProfile: true,
        },
      });

      return NextResponse.json({ success: true, driver: newDriver });
    }

    if (!driverId) {
      return NextResponse.json({ error: 'Falta driverId' }, { status: 400 });
    }

    // Upsert delivery profile
    const profile = await prisma.deliveryProfile.upsert({
      where: { userId: driverId },
      update: {
        status: status || undefined,
        vehicleType: vehicleType || undefined,
        plateNumber: plateNumber !== undefined ? plateNumber : undefined,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : undefined,
        activeCashFloat: activeCashFloat !== undefined ? Number(activeCashFloat) : undefined,
        commissionPerOrder: commissionPerOrder !== undefined ? Number(commissionPerOrder) : undefined,
      },
      create: {
        userId: driverId,
        status: status || 'AVAILABLE',
        vehicleType: vehicleType || 'MOTO',
        plateNumber: plateNumber || '',
        phoneNumber: phoneNumber || '',
        activeCashFloat: activeCashFloat !== undefined ? Number(activeCashFloat) : 0,
        commissionPerOrder: commissionPerOrder !== undefined ? Number(commissionPerOrder) : 0,
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: unknown) {
    console.error('Error updating driver profile:', error);
    return NextResponse.json({ error: 'Error al actualizar chofer' }, { status: 500 });
  }
}
