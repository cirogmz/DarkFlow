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
    const status = searchParams.get('status');
    const driverId = searchParams.get('driverId');

    const whereClause: any = {
      brandId: session.activeBrandId,
    };

    if (status) {
      whereClause.status = status;
    }
    
    if (driverId) {
      whereClause.driverId = driverId;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { 
      customerName, 
      customerPhone, 
      customerAddress, 
      source, // UBER_EATS, RAPPI, WEB, PHONE
      notes, 
      tip = 0, 
      items // Array of { productId, quantity, price, notes }
    } = await req.json();

    if (!customerName || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price * item.quantity;
    }

    // 16% Tax (IVA)
    const tax = parseFloat((subtotal * 0.16).toFixed(2));
    const total = parseFloat((subtotal + tax + parseFloat(tip)).toFixed(2));

    // Generate unique order number
    const totalOrdersCount = await prisma.order.count();
    const orderNumber = `DF-${1000 + totalOrdersCount + 1}`;

    // Create Order in transaction
    const order = await prisma.order.create({
      data: {
        orderNumber,
        brandId: activeBrandId,
        source,
        status: 'RECEIVED',
        customerName,
        customerPhone,
        customerAddress,
        notes,
        subtotal,
        tax,
        tip: parseFloat(tip),
        total,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
