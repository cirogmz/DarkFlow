import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { orderEvents } from '@/lib/events';

interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

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

    const whereClause: Prisma.OrderWhereInput = {
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
        table: true,
        customer: true,
        coupon: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error: unknown) {
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
      source = 'WEB', // UBER_EATS, RAPPI, WEB, PHONE, DINE_IN, TAKEAWAY
      notes, 
      tip = 0, 
      tableId,
      diners = 1,
      redeemedPoints = 0,
      discount = 0,
      couponCode,
      items // Array of { productId, quantity, price, notes }
    } = await req.json();

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const typedItems = items as OrderItemInput[];

    // Calculate subtotal
    let subtotal = 0;
    for (const item of typedItems) {
      subtotal += item.price * item.quantity;
    }

    // Process coupon validation if code provided
    let appliedCouponId: string | null = null;
    let appliedCouponCode: string | null = null;
    let calculatedCouponDiscount = 0;

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const cleanCode = couponCode.trim().toUpperCase();
      const couponRecord = await prisma.coupon.findUnique({
        where: { code: cleanCode },
      });

      if (couponRecord && couponRecord.isActive) {
        const brandMatch = !couponRecord.brandId || couponRecord.brandId === activeBrandId;
        const limitNotReached = couponRecord.usageLimit === null || couponRecord.usedCount < couponRecord.usageLimit;
        const minOrderMet = subtotal >= couponRecord.minOrderAmount;
        const now = new Date();
        const dateValid = (!couponRecord.startDate || now >= new Date(couponRecord.startDate)) &&
                          (!couponRecord.endDate || now <= new Date(couponRecord.endDate));

        if (brandMatch && limitNotReached && minOrderMet && dateValid) {
          appliedCouponId = couponRecord.id;
          appliedCouponCode = couponRecord.code;

          if (couponRecord.discountType === 'PERCENTAGE') {
            const raw = (subtotal * couponRecord.discountValue) / 100;
            calculatedCouponDiscount = couponRecord.maxDiscount ? Math.min(raw, couponRecord.maxDiscount) : raw;
          } else {
            calculatedCouponDiscount = Math.min(subtotal, couponRecord.discountValue);
          }
        }
      }
    }

    // Apply combined discount: coupon discount + any manual/loyalty discount passed
    const totalDiscount = Math.min(subtotal, Math.max(0, calculatedCouponDiscount + (parseFloat(String(discount)) || 0)));
    const subtotalAfterDiscount = Math.max(0, subtotal - totalDiscount);

    // 16% Tax (IVA)
    const tax = parseFloat((subtotalAfterDiscount * 0.16).toFixed(2));
    const total = parseFloat((subtotalAfterDiscount + tax + parseFloat(String(tip))).toFixed(2));

    // Points earned: 1 pt per $10 MXN total spent
    const pointsEarned = Math.floor(total / 10);
    const numRedeemedPoints = Math.max(0, parseInt(String(redeemedPoints), 10) || 0);

    // Generate unique order number
    const totalOrdersCount = await prisma.order.count();
    const orderNumber = `DF-${1000 + totalOrdersCount + 1}`;

    // Create Order in transaction and update table/customer status
    const order = await prisma.$transaction(async (tx) => {
      let linkedCustomerId: string | null = null;

      if (customerPhone && customerPhone.trim()) {
        const cleanPhone = customerPhone.trim();
        const existingCustomer = await tx.customer.findUnique({
          where: { phone: cleanPhone },
        });

        if (existingCustomer) {
          linkedCustomerId = existingCustomer.id;
          const newPoints = Math.max(0, existingCustomer.loyaltyPoints - numRedeemedPoints + pointsEarned);

          await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: customerName.trim(),
              address: customerAddress ? customerAddress.trim() : existingCustomer.address,
              totalOrders: { increment: 1 },
              totalSpent: { increment: total },
              loyaltyPoints: newPoints,
            },
          });
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              name: customerName.trim(),
              phone: cleanPhone,
              address: customerAddress ? customerAddress.trim() : null,
              brandId: activeBrandId,
              totalOrders: 1,
              totalSpent: total,
              loyaltyPoints: Math.max(0, pointsEarned - numRedeemedPoints),
            },
          });
          linkedCustomerId = newCustomer.id;
        }
      }

      // Increment coupon usage count if applied
      if (appliedCouponId) {
        await tx.coupon.update({
          where: { id: appliedCouponId },
          data: {
            usedCount: { increment: 1 },
          },
        });
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          brandId: activeBrandId,
          source,
          status: 'RECEIVED',
          customerName: customerName.trim(),
          customerPhone: customerPhone ? customerPhone.trim() : null,
          customerAddress: customerAddress ? customerAddress.trim() : null,
          customerId: linkedCustomerId,
          couponId: appliedCouponId,
          couponCode: appliedCouponCode,
          discountAmount: totalDiscount,
          notes: notes || null,
          subtotal: subtotalAfterDiscount,
          tax,
          tip: parseFloat(String(tip)),
          total,
          tableId: tableId || null,
          diners: diners ? parseInt(String(diners), 10) : 1,
          items: {
            create: typedItems.map((item) => ({
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
          table: true,
          customer: true,
          coupon: true,
        },
      });

      // If attached to a physical table, mark the table as OCCUPIED
      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: 'OCCUPIED' },
        });
      }

      return newOrder;
    });

    // Emit real-time order creation event for KDS and dispatch
    orderEvents.emit('order_event', {
      action: 'CREATED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      brandId: order.brandId,
      source: order.source,
      customerName: order.customerName,
      tableId: order.tableId,
      timestamp: new Date().toISOString(),
      order,
    });

    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
