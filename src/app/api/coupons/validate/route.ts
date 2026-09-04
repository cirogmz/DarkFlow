import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { code, subtotal = 0 } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Ingresa un código de cupón' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const orderSubtotal = Math.max(0, parseFloat(String(subtotal)) || 0);

    const coupon = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (!coupon) {
      return NextResponse.json({ valid: false, error: `El cupón "${cleanCode}" no existe` }, { status: 404 });
    }

    // Check brand matching
    if (coupon.brandId && coupon.brandId !== session.activeBrandId) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Este cupón no es válido para la marca seleccionada' 
      }, { status: 400 });
    }

    // Check active status
    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, error: 'Este cupón ha sido desactivado' }, { status: 400 });
    }

    const now = new Date();

    // Check start date
    if (coupon.startDate && now < new Date(coupon.startDate)) {
      return NextResponse.json({ 
        valid: false, 
        error: `Este cupón será válido a partir de ${new Date(coupon.startDate).toLocaleDateString()}` 
      }, { status: 400 });
    }

    // Check expiration date
    if (coupon.endDate && now > new Date(coupon.endDate)) {
      return NextResponse.json({ valid: false, error: 'Este cupón ha expirado' }, { status: 400 });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ valid: false, error: 'Este cupón ha alcanzado su límite máximo de usos' }, { status: 400 });
    }

    // Check minimum order amount
    if (orderSubtotal < coupon.minOrderAmount) {
      return NextResponse.json({
        valid: false,
        error: `Monto mínimo de compra requerido: $${coupon.minOrderAmount.toFixed(2)} (Subtotal actual: $${orderSubtotal.toFixed(2)})`,
      }, { status: 400 });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      const rawDiscount = (orderSubtotal * coupon.discountValue) / 100;
      discountAmount = coupon.maxDiscount ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount;
    } else {
      discountAmount = Math.min(orderSubtotal, coupon.discountValue);
    }

    discountAmount = parseFloat(discountAmount.toFixed(2));

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discountAmount,
      message: `¡Cupón ${coupon.code} aplicado con éxito! Descuento: -$${discountAmount.toFixed(2)}`,
    });
  } catch (error: unknown) {
    console.error('Error validating coupon:', error);
    return NextResponse.json({ valid: false, error: 'Error al validar cupón' }, { status: 500 });
  }
}
