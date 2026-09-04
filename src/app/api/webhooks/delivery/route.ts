import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { getSessionFromCookies } from '@/lib/auth';

const DEFAULT_COMMISSIONS: Record<string, number> = {
  UBER_EATS: 28.0,
  RAPPI: 25.0,
  DIDI_FOOD: 22.0,
};

interface WebhookItemInput {
  productId: string;
  quantity: number;
  price?: number;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      platform = 'UBER_EATS', // UBER_EATS | RAPPI | DIDI_FOOD
      brandId: explicitBrandId,
      externalOrderId,
      customerName = 'Cliente Delivery App',
      customerPhone,
      customerAddress = 'Entrega a domicilio por app',
      notes,
      items,
      tip = 0,
      commissionRate,
      deliveryService = 'PLATFORM_DRIVER', // PLATFORM_DRIVER | INTERNAL_DRIVER
    } = body;

    // Resolve Brand ID
    let targetBrandId = explicitBrandId;
    if (!targetBrandId) {
      // Check session cookie as fallback (for simulator)
      const cookieHeader = req.headers.get('cookie') || '';
      const session = getSessionFromCookies(cookieHeader);
      targetBrandId = session?.activeBrandId;
    }

    if (!targetBrandId) {
      // Fallback to first active brand in database
      const firstBrand = await prisma.brand.findFirst({
        where: { isActive: true },
      });
      targetBrandId = firstBrand?.id;
    }

    if (!targetBrandId) {
      return NextResponse.json({ error: 'No se encontró una marca activa para asociar el pedido' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El pedido debe incluir al menos un producto' }, { status: 400 });
    }

    const typedItems = items as WebhookItemInput[];

    // Fetch product details to ensure prices and valid products
    const productIds = typedItems.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Calculate subtotal
    let subtotal = 0;
    const finalItems = typedItems.map((item) => {
      const prod = productMap.get(item.productId);
      const unitPrice = item.price !== undefined ? parseFloat(String(item.price)) : (prod?.price || 0);
      const qty = Math.max(1, parseInt(String(item.quantity || 1), 10));
      subtotal += unitPrice * qty;

      return {
        productId: item.productId,
        quantity: qty,
        price: unitPrice,
        notes: item.notes || null,
      };
    });

    // Taxes & Total
    const tax = parseFloat((subtotal * 0.16).toFixed(2));
    const total = parseFloat((subtotal + tax + parseFloat(String(tip || 0))).toFixed(2));

    // Commission Calculation
    const validPlatform = String(platform).toUpperCase();
    const rate = commissionRate !== undefined 
      ? Math.max(0, parseFloat(String(commissionRate))) 
      : (DEFAULT_COMMISSIONS[validPlatform] || 25.0);

    const platformCommission = parseFloat(((total * rate) / 100).toFixed(2));
    const netPayout = parseFloat((total - platformCommission).toFixed(2));

    // Generate external order ID if missing
    const generatedExternalId = externalOrderId 
      ? String(externalOrderId).trim() 
      : `${validPlatform.replace('_', '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate unique internal order number
    const totalOrdersCount = await prisma.order.count();
    const orderNumber = `DF-${1000 + totalOrdersCount + 1}`;

    // Create Order and update CashSession in transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      // Optional customer lookup/creation
      let linkedCustomerId: string | null = null;
      if (customerPhone && customerPhone.trim()) {
        const cleanPhone = customerPhone.trim();
        const existingCust = await tx.customer.findUnique({
          where: { phone: cleanPhone },
        });

        if (existingCust) {
          linkedCustomerId = existingCust.id;
          await tx.customer.update({
            where: { id: existingCust.id },
            data: {
              totalOrders: { increment: 1 },
              totalSpent: { increment: total },
            },
          });
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          brandId: targetBrandId,
          source: validPlatform,
          status: 'RECEIVED',
          customerName: customerName.trim(),
          customerPhone: customerPhone ? customerPhone.trim() : null,
          customerAddress: customerAddress ? customerAddress.trim() : null,
          customerId: linkedCustomerId,
          externalOrderId: generatedExternalId,
          platformCommissionRate: rate,
          platformCommission,
          netPayout,
          deliveryService,
          notes: notes ? String(notes).trim() : `Pedido externo vía ${validPlatform} (Comisión: ${rate}%)`,
          subtotal,
          tax,
          tip: parseFloat(String(tip || 0)),
          total,
          items: {
            create: finalItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          brand: true,
          customer: true,
        },
      });

      // Update active cash session appsSales if open
      const activeCash = await tx.cashSession.findFirst({
        where: { brandId: targetBrandId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });

      if (activeCash) {
        await tx.cashSession.update({
          where: { id: activeCash.id },
          data: {
            appsSales: { increment: total },
          },
        });
      }

      return order;
    });

    // Emit real-time order creation event for KDS and dispatch
    orderEvents.emit('order_event', {
      action: 'CREATED',
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      status: newOrder.status,
      brandId: newOrder.brandId,
      source: newOrder.source,
      customerName: newOrder.customerName,
      externalOrderId: newOrder.externalOrderId,
      timestamp: new Date().toISOString(),
      order: newOrder,
    });

    return NextResponse.json({
      success: true,
      message: `Pedido externo ${newOrder.externalOrderId} recibido y enviado a cocina`,
      order: newOrder,
      financials: {
        subtotal,
        tax,
        tip,
        total,
        platformCommission,
        netPayout,
        commissionRate: rate,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error processing delivery webhook:', error);
    return NextResponse.json({ error: 'Error procesando webhook de delivery' }, { status: 500 });
  }
}
