import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

interface PublicOrderItemInput {
  productId: string;
  quantity: number;
  price?: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      brandSlug,
      customerName,
      customerPhone,
      orderType = 'DINE_IN',
      tableNumber,
      notes,
      couponCode,
      items,
    } = body;

    if (!brandSlug) {
      return NextResponse.json({ error: 'Slug de marca requerido' }, { status: 400 });
    }

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito no puede estar vacío' }, { status: 400 });
    }

    // Find active brand
    const brand = await prisma.brand.findUnique({
      where: { slug: brandSlug.toLowerCase() },
    });

    if (!brand || !brand.isActive) {
      return NextResponse.json({ error: 'Marca no encontrada o inactiva' }, { status: 404 });
    }

    // Find table if dine-in
    let matchedTable = null;
    if (orderType === 'DINE_IN' && tableNumber) {
      matchedTable = await prisma.table.findFirst({
        where: {
          brandId: brand.id,
          number: String(tableNumber).trim(),
        },
      });
    }

    // Validate and fetch products
    const productIds = items.map((i: PublicOrderItemInput) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        brandId: brand.id,
        isActive: true,
      },
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (dbProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Uno o más platillos no están disponibles actualmente' },
        { status: 400 }
      );
    }

    // Calculate subtotal from authoritative product prices
    let subtotal = 0;
    const validatedItems = items.map((item: PublicOrderItemInput) => {
      const p = dbProducts.find((dbP) => dbP.id === item.productId)!;
      const itemSubtotal = p.price * item.quantity;
      subtotal += itemSubtotal;
      return {
        productId: p.id,
        quantity: item.quantity,
        price: p.price,
        notes: item.notes ? item.notes.trim() : null,
      };
    });

    // Check optional coupon
    let discountAmount = 0;
    let validatedCoupon = null;
    if (couponCode && couponCode.trim()) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() },
      });

      if (coupon && coupon.isActive && (!coupon.brandId || coupon.brandId === brand.id)) {
        const now = new Date();
        const isNotExpired = (!coupon.startDate || now >= coupon.startDate) && (!coupon.endDate || now <= coupon.endDate);
        const hasUsesLeft = !coupon.usageLimit || coupon.usedCount < coupon.usageLimit;
        const meetsMinOrder = subtotal >= coupon.minOrderAmount;

        if (isNotExpired && hasUsesLeft && meetsMinOrder) {
          if (coupon.discountType === 'PERCENTAGE') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
          } else {
            discountAmount = Math.min(subtotal, coupon.discountValue);
          }
          if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
            discountAmount = coupon.maxDiscount;
          }
          discountAmount = parseFloat(discountAmount.toFixed(2));
          validatedCoupon = coupon;
        }
      }
    }

    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const tax = parseFloat((subtotalAfterDiscount * 0.16).toFixed(2));
    const total = parseFloat((subtotalAfterDiscount + tax).toFixed(2));

    // Handle customer registration / loyalty points
    let customerId: string | null = null;
    const cleanPhone = customerPhone ? customerPhone.trim() : null;
    if (cleanPhone && cleanPhone.length >= 7) {
      const existingCustomer = await prisma.customer.findUnique({
        where: { phone: cleanPhone },
      });

      const earnedPoints = Math.floor(total / 10);

      if (existingCustomer) {
        const updated = await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: customerName.trim(),
            totalOrders: { increment: 1 },
            totalSpent: { increment: total },
            loyaltyPoints: { increment: earnedPoints },
          },
        });
        customerId = updated.id;
      } else {
        const created = await prisma.customer.create({
          data: {
            name: customerName.trim(),
            phone: cleanPhone,
            brandId: brand.id,
            totalOrders: 1,
            totalSpent: total,
            loyaltyPoints: earnedPoints,
          },
        });
        customerId = created.id;
      }
    }

    // Generate Order Number
    const countToday = await prisma.order.count({
      where: {
        brandId: brand.id,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
    const orderNumber = `QR-${(countToday + 1).toString().padStart(4, '0')}`;

    // Execute atomic creation and inventory deduction
    const order = await prisma.$transaction(async (tx) => {
      // 1. Check and deduct ingredients
      for (const item of validatedItems) {
        const prod = dbProducts.find((p) => p.id === item.productId)!;
        for (const ri of prod.recipeItems) {
          const needed = ri.quantity * item.quantity;
          if (ri.ingredient.stock < needed) {
            throw new Error(`Stock insuficiente para el insumo: ${ri.ingredient.name}`);
          }
          await tx.ingredient.update({
            where: { id: ri.ingredientId },
            data: { stock: { decrement: needed } },
          });
        }
      }

      // 2. Increment coupon usage
      if (validatedCoupon) {
        await tx.coupon.update({
          where: { id: validatedCoupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // 3. Mark table as OCCUPIED if dine-in
      if (matchedTable) {
        await tx.table.update({
          where: { id: matchedTable.id },
          data: { status: 'OCCUPIED' },
        });
      }

      // 4. Create Order
      return await tx.order.create({
        data: {
          orderNumber,
          source: orderType === 'DINE_IN' ? 'DINE_IN' : 'TAKEAWAY',
          status: 'RECEIVED',
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          notes: notes ? notes.trim() : null,
          subtotal,
          tax,
          tip: 0,
          total,
          brandId: brand.id,
          tableId: matchedTable ? matchedTable.id : null,
          customerId,
          couponId: validatedCoupon ? validatedCoupon.id : null,
          couponCode: validatedCoupon ? validatedCoupon.code : null,
          discountAmount,
          items: {
            create: validatedItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
              notes: i.notes,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true },
              },
            },
          },
          table: true,
          brand: true,
        },
      });
    });

    // 5. Emit real-time SSE event to trigger Kitchen KDS and bell sound!
    orderEvents.emit('order_event', {
      action: 'CREATED',
      order,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating public order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar el pedido' },
      { status: 500 }
    );
  }
}
