import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { calculateItemPriceRule } from '@/lib/priceRules';
import { redeemCustomerWallet } from '@/lib/wallet';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    // Fetch all active brands for multi-brand kiosk support
    const activeBrands = await prisma.brand.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        kioskEnabled: true,
        kioskHeroTitle: true,
        kioskHeroSubtitle: true,
        kioskIdleTimeoutSeconds: true,
        kioskAllowCashAtCounter: true,
        kioskPagersEnabled: true,
      },
      orderBy: { name: 'asc' },
    });

    if (activeBrands.length === 0) {
      return NextResponse.json({ error: 'No hay marcas activas disponibles' }, { status: 404 });
    }

    // Determine target brand
    let selectedBrand = activeBrands[0];
    if (slug) {
      const matched = activeBrands.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
      if (matched) selectedBrand = matched;
    }

    // Fetch categories with active products & modifiers for target brand
    const [categories, combos, priceRules, tables] = await Promise.all([
      prisma.category.findMany({
        where: { brandId: selectedBrand.id },
        orderBy: { name: 'asc' },
        include: {
          products: {
            where: { isActive: true },
            include: {
              modifierGroups: {
                include: {
                  modifierGroup: {
                    include: {
                      options: true,
                    },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          },
        },
      }),
      prisma.combo.findMany({
        where: { brandId: selectedBrand.id, isActive: true },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
      prisma.priceRule.findMany({
        where: { brandId: selectedBrand.id, isActive: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.table.findMany({
        where: { brandId: selectedBrand.id, status: 'AVAILABLE' },
        select: { id: true, number: true, name: true, zone: true, capacity: true },
        orderBy: [{ zone: 'asc' }, { number: 'asc' }],
      }),
    ]);

    return NextResponse.json({
      success: true,
      brands: activeBrands,
      selectedBrand,
      categories,
      combos,
      priceRules,
      availableTables: tables,
    });
  } catch (error: unknown) {
    console.error('Error fetching kiosk data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cargar datos del kiosco' },
      { status: 500 }
    );
  }
}

interface KioskOrderItemInput {
  productId: string;
  quantity: number;
  notes?: string;
  modifiers?: { id?: string; name: string; price?: number }[];
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
      locatorNumber,
      notes,
      paymentMethod = 'CARD', // 'CARD' | 'WALLET' | 'CASH_COUNTER'
      items,
    } = body;

    if (!brandSlug) {
      return NextResponse.json({ error: 'Slug de marca requerido' }, { status: 400 });
    }

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: 'Por favor ingresa tu nombre' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito no puede estar vacío' }, { status: 400 });
    }

    // Find brand
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

    // Fetch and validate DB products
    const productIds = items.map((i: KioskOrderItemInput) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        brandId: brand.id,
        isActive: true,
      },
    });

    if (dbProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Uno o más productos seleccionados ya no están disponibles' },
        { status: 400 }
      );
    }

    // Fetch active price rules
    const activePriceRules = await prisma.priceRule.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Authoritative pricing calculation
    let subtotal = 0;
    const validatedItems = items.map((item: KioskOrderItemInput) => {
      const p = dbProducts.find((dbP) => dbP.id === item.productId)!;
      let extraModifiersPrice = 0;
      if (item.modifiers && Array.isArray(item.modifiers)) {
        extraModifiersPrice = item.modifiers.reduce(
          (sum: number, mod) => sum + (parseFloat(String(mod.price || 0)) || 0),
          0
        );
      }

      const ruleEval = calculateItemPriceRule(
        { id: p.id, price: p.price, categoryId: p.categoryId },
        item.quantity,
        activePriceRules,
        new Date(),
        matchedTable?.zone || undefined
      );

      const effectiveUnitPrice = ruleEval.hasPromo
        ? ruleEval.effectiveUnitPrice + extraModifiersPrice
        : p.price + extraModifiersPrice;

      const originalUnitPrice = p.price + extraModifiersPrice;
      const lineTotal = effectiveUnitPrice * item.quantity;
      subtotal += lineTotal;

      return {
        productId: p.id,
        name: p.name,
        quantity: item.quantity,
        price: effectiveUnitPrice,
        originalPrice: originalUnitPrice,
        discountAmount: ruleEval.hasPromo ? ruleEval.savings : 0,
        promoRuleId: ruleEval.rule?.id || null,
        promoBadge: ruleEval.badgeText || null,
        notes: item.notes?.trim() || null,
        modifiers: item.modifiers ? JSON.stringify(item.modifiers) : null,
      };
    });

    const tax = 0; // Tax included
    const total = parseFloat(subtotal.toFixed(2));

    // Handle wallet payment if selected
    if (paymentMethod === 'WALLET') {
      if (!customerPhone || !customerPhone.trim()) {
        return NextResponse.json(
          { error: 'Se requiere tu número de teléfono celular para debitar de tu Monedero Digital' },
          { status: 400 }
        );
      }

      const customer = await prisma.customer.findFirst({
        where: { phone: customerPhone.trim(), brandId: brand.id },
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'No se encontró una cuenta de Monedero vinculada a este número' },
          { status: 404 }
        );
      }

      if (customer.walletBalance < total) {
        return NextResponse.json(
          {
            error: `Saldo insuficiente en Monedero ($${customer.walletBalance.toFixed(2)} MXN). Total de la orden: $${total.toFixed(2)} MXN.`,
          },
          { status: 400 }
        );
      }
    }

    // Generate Kiosk Turn Number: e.g. #K-104
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayKioskCount = await prisma.order.count({
      where: {
        brandId: brand.id,
        source: 'KIOSK',
        createdAt: { gte: todayStart },
      },
    });

    const turnSeq = (todayKioskCount + 1).toString().padStart(2, '0');
    const turnNumber = `K-${turnSeq}`;
    const orderNumber = `ORD-K-${Date.now().toString().slice(-6)}`;

    const isPaid = paymentMethod === 'CARD' || paymentMethod === 'WALLET';
    const paymentStatus = isPaid ? 'PAID' : 'PENDING';

    const orderNotes = [
      `[KIOSCO AUTOSERVICIO ${turnNumber}]`,
      orderType === 'DINE_IN' ? '🍽️ Comer en Salón' : '🛍️ Para Llevar',
      locatorNumber ? `Localizador/Buzzer: ${locatorNumber}` : null,
      notes ? `Notas: ${notes}` : null,
    ]
      .filter(Boolean)
      .join(' • ');

    const newOrder = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber,
          brandId: brand.id,
          source: 'KIOSK',
          status: 'RECEIVED',
          customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null,
          locatorNumber: locatorNumber?.trim() || null,
          notes: orderNotes,
          subtotal,
          tax,
          tip: 0,
          total,
          paymentStatus,
          paymentMethod: paymentMethod === 'CASH_COUNTER' ? 'CASH' : paymentMethod,
          paidAmount: isPaid ? total : 0,
          paidAt: isPaid ? new Date() : null,
          tableId: matchedTable?.id || null,
          items: {
            create: validatedItems.map((vi) => ({
              productId: vi.productId,
              quantity: vi.quantity,
              price: vi.price,
              originalPrice: vi.originalPrice,
              discountAmount: vi.discountAmount,
              promoRuleId: vi.promoRuleId,
              promoBadge: vi.promoBadge,
              notes: vi.notes,
              modifiers: vi.modifiers,
              status: 'PENDING',
              paidQuantity: isPaid ? vi.quantity : 0,
              isPaid: isPaid,
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
          brand: true,
        },
      });

      // If card or wallet, create PaymentTransaction
      if (isPaid) {
        await tx.paymentTransaction.create({
          data: {
            orderId: ord.id,
            brandId: brand.id,
            gateway: paymentMethod,
            status: 'PAID',
            amount: total,
            tip: 0,
            currency: 'MXN',
            method: 'FULL',
            notes: `Pago Kiosco Autoservicio (${turnNumber})`,
            payerName: customerName.trim(),
            payerPhone: customerPhone?.trim() || null,
            gatewayPaymentId: `kiosk_pay_${Date.now()}`,
          },
        });
      }

      // If wallet, redeem
      if (paymentMethod === 'WALLET' && customerPhone) {
        const customer = await tx.customer.findFirst({
          where: { phone: customerPhone.trim(), brandId: brand.id },
        });
        if (customer) {
          await redeemCustomerWallet({
            customerId: customer.id,
            brandId: brand.id,
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            amountToRedeem: total,
            userName: `Kiosco Autoservicio ${turnNumber}`,
          });
        }
      }

      // If matched table, update table status to OCCUPIED
      if (matchedTable) {
        await tx.table.update({
          where: { id: matchedTable.id },
          data: { status: 'OCCUPIED' },
        });
      }

      return ord;
    });

    // Emit reactive event to KDS & Expo stations
    orderEvents.emit('order_created', {
      id: newOrder.id,
      orderNumber: newOrder.orderNumber,
      brandId: brand.id,
      source: 'KIOSK',
      customerName: newOrder.customerName,
      tableNumber: matchedTable?.number || locatorNumber || turnNumber,
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      order: newOrder,
    });

    await recordAuditLog({
      brandId: brand.id,
      action: 'KIOSK_ORDER_CREATED',
      entityType: 'Order',
      entityId: newOrder.id,
      details: {
        orderNumber: newOrder.orderNumber,
        turnNumber,
        locatorNumber,
        customerName: newOrder.customerName,
        total: newOrder.total,
        paymentMethod,
        paymentStatus,
      },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: `¡Orden confirmada! Tu turno es #${turnNumber}`,
      turnNumber,
      order: {
        id: newOrder.id,
        orderNumber: newOrder.orderNumber,
        turnNumber,
        customerName: newOrder.customerName,
        total: newOrder.total,
        paymentStatus: newOrder.paymentStatus,
        paymentMethod: newOrder.paymentMethod,
        orderType,
        locatorNumber: newOrder.locatorNumber,
        itemsCount: newOrder.items.length,
        createdAt: newOrder.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('Error creating kiosk order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar pedido en kiosco' },
      { status: 500 }
    );
  }
}
