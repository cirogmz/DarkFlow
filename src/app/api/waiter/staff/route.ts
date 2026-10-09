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

    const staff = await prisma.user.findMany({
      where: {
        role: { in: ['WAITER', 'CASHIER', 'BRAND_ADMIN', 'SUPER_ADMIN'] },
        brands: {
          some: { brandId: session.activeBrandId },
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
        pinCode: true,
      },
      orderBy: { name: 'asc' },
    });

    const sanitizedStaff = staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      hasPin: Boolean(s.pinCode && s.pinCode.trim().length > 0),
    }));

    return NextResponse.json({
      success: true,
      staff: sanitizedStaff,
    });
  } catch (error: unknown) {
    console.error('Error fetching waiter staff:', error);
    return NextResponse.json({ error: 'Error al consultar personal de servicio' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { pin } = await req.json();
    if (!pin) {
      return NextResponse.json({ error: 'Falta PIN de mesero' }, { status: 400 });
    }

    const trimmedPin = String(pin).trim();

    // Find staff with this PIN associated with the active brand
    const user = await prisma.user.findFirst({
      where: {
        pinCode: trimmedPin,
        brands: {
          some: { brandId: session.activeBrandId },
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'PIN incorrecto o mesero no encontrado' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user,
      message: `Mesero activo: ${user.name}`,
    });
  } catch (error: unknown) {
    console.error('Error verifying waiter PIN:', error);
    return NextResponse.json({ error: 'Error al verificar PIN de mesero' }, { status: 500 });
  }
}
