import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const drivers = await prisma.user.findMany({
      where: { role: 'DELIVERY' },
      include: {
        deliveryProfile: true,
      },
    });

    return NextResponse.json({ drivers });
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

    const { driverId, status, vehicleType, plateNumber } = await req.json();

    if (!driverId) {
      return NextResponse.json({ error: 'Falta driverId' }, { status: 400 });
    }

    // Upsert delivery profile
    const profile = await prisma.deliveryProfile.upsert({
      where: { userId: driverId },
      update: {
        status: status || undefined,
        vehicleType: vehicleType || undefined,
        plateNumber: plateNumber || undefined,
      },
      create: {
        userId: driverId,
        status: status || 'AVAILABLE',
        vehicleType: vehicleType || 'MOTO',
        plateNumber: plateNumber || '',
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: unknown) {
    console.error('Error updating driver profile:', error);
    return NextResponse.json({ error: 'Error al actualizar chofer' }, { status: 500 });
  }
}
