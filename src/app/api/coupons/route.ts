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

    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get('active') === 'true';

    const whereClause: {
      OR?: Array<{ brandId: string | null }>;
      isActive?: boolean;
    } = {
      OR: [
        { brandId: session.activeBrandId },
        { brandId: null }, // Global coupons
      ],
    };

    if (onlyActive) {
      whereClause.isActive = true;
    }

    const coupons = await prisma.coupon.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    return NextResponse.json({ coupons });
  } catch (error: unknown) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ error: 'Error al obtener cupones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    // Role check: Only SUPER_ADMIN or BRAND_ADMIN
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes para crear promociones' }, { status: 403 });
    }

    const body = await req.json();
    const {
      code,
      description,
      discountType, // 'PERCENTAGE' | 'FIXED_AMOUNT'
      discountValue,
      minOrderAmount = 0,
      maxDiscount,
      usageLimit,
      startDate,
      endDate,
      isGlobal = false,
    } = body;

    if (!code || !discountType || discountValue === undefined || discountValue === null) {
      return NextResponse.json({ error: 'Código, tipo y valor de descuento son requeridos' }, { status: 400 });
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Check unique code
    const existing = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json({ error: `El código de cupón "${cleanCode}" ya existe` }, { status: 409 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: cleanCode,
        description: description ? String(description).trim() : null,
        discountType: discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
        discountValue: parseFloat(String(discountValue)),
        minOrderAmount: parseFloat(String(minOrderAmount || 0)),
        maxDiscount: maxDiscount ? parseFloat(String(maxDiscount)) : null,
        usageLimit: usageLimit ? parseInt(String(usageLimit), 10) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
        brandId: isGlobal ? null : session.activeBrandId,
      },
    });

    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating coupon:', error);
    return NextResponse.json({ error: 'Error al crear cupón' }, { status: 500 });
  }
}
