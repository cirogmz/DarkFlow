import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { createPaymentSession } from '@/lib/payments';
import { determineCustomerTier, calculateLoyaltyPointsEarned } from '@/lib/loyaltyTiers';
import { calculateOrderCashback, generateCustomerWalletQrCode } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

interface PublicOrderItemInput {
  productId: string;
  quantity: number;
  price?: number;
  notes?: string;
  modifiers?: unknown;
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
      paymentMethod = 'CASH',
      giftCardCode,
      giftCardPin,
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
        category: true,
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

    // Calculate subtotal from authoritative product prices plus modifiers
    let subtotal = 0;
    const validatedItems = items.map((item: PublicOrderItemInput) => {
      const p = dbProducts.find((dbP) => dbP.id === item.productId)!;
      let extraModifiersPrice = 0;
      if (item.modifiers && Array.isArray(item.modifiers)) {
        extraModifiersPrice = item.modifiers.reduce((sum: number, mod: { price?: number }) => sum + (parseFloat(String(mod.price || 0)) || 0), 0);
      }
      const unitPrice = p.price + extraModifiersPrice;
      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;
      return {
        productId: p.id,
        quantity: item.quantity,
        price: unitPrice,
        notes: item.notes ? item.notes.trim() : null,
        modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers)) : null,
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

    // Handle customer registration / loyalty points & cashback wallet
    let customerId: string | null = null;
    let actualCashbackEarned = 0;
    let initialWalletBal = 0;
    const cleanPhone = customerPhone ? customerPhone.trim() : null;
    if (cleanPhone && cleanPhone.length >= 7) {
      const existingCustomer = await prisma.customer.findUnique({
        where: { phone: cleanPhone },
      });

      if (existingCustomer) {
        initialWalletBal = existingCustomer.walletBalance;
        const updatedTotalSpent = existingCustomer.totalSpent + total;
        const updatedTotalOrders = existingCustomer.totalOrders + 1;
        const newTier = determineCustomerTier(updatedTotalSpent, updatedTotalOrders);
        const earnedPoints = calculateLoyaltyPointsEarned(total, existingCustomer.pointsMultiplier || newTier.pointsMultiplier);
        
        const cb = calculateOrderCashback(total, newTier.id, existingCustomer.cashbackRatePct);
        actualCashbackEarned = cb.cashbackAmount;
        const newWalletBal = parseFloat((initialWalletBal + actualCashbackEarned).toFixed(2));

        const updated = await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: customerName.trim(),
            totalOrders: { increment: 1 },
            totalSpent: { increment: total },
            loyaltyPoints: { increment: earnedPoints },
            tier: newTier.id,
            pointsMultiplier: newTier.pointsMultiplier,
            tierDiscountPct: newTier.discountPct,
            walletBalance: newWalletBal,
            walletQrCode: existingCustomer.walletQrCode || generateCustomerWalletQrCode(existingCustomer.id),
            totalCashbackEarned: { increment: actualCashbackEarned },
          },
        });
        customerId = updated.id;
      } else {
        const newTier = determineCustomerTier(total, 1);
        const earnedPoints = calculateLoyaltyPointsEarned(total, newTier.pointsMultiplier);
        const cb = calculateOrderCashback(total, newTier.id);
        actualCashbackEarned = cb.cashbackAmount;

        const created = await prisma.customer.create({
          data: {
            name: customerName.trim(),
            phone: cleanPhone,
            brandId: brand.id,
            totalOrders: 1,
            totalSpent: total,
            loyaltyPoints: earnedPoints,
            tier: newTier.id,
            pointsMultiplier: newTier.pointsMultiplier,
            tierDiscountPct: newTier.discountPct,
            walletBalance: actualCashbackEarned,
            walletQrCode: generateCustomerWalletQrCode(cleanPhone),
            totalCashbackEarned: actualCashbackEarned,
            totalCashbackSpent: 0,
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

      const calculatedSla = dbProducts.reduce((max, p) => Math.max(max, p.targetPrepTime || 10), 10);
      const isGiftCardPay = paymentMethod === 'GIFT_CARD' || paymentMethod === 'MONEDERO';

      // 4. Create Order
      const createdOrder = await tx.order.create({
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
          paidAmount: isGiftCardPay ? total : 0,
          brandId: brand.id,
          tableId: matchedTable ? matchedTable.id : null,
          customerId,
          couponId: validatedCoupon ? validatedCoupon.id : null,
          couponCode: validatedCoupon ? validatedCoupon.code : null,
          discountAmount,
          paymentMethod,
          paymentStatus: isGiftCardPay ? 'PAID' : 'PENDING',
          paidAt: isGiftCardPay ? new Date() : null,
          prepTimeTarget: calculatedSla,
          currentStage: 'STARTER',
          cashbackEarned: actualCashbackEarned,
          items: {
            create: validatedItems.map((i) => {
              const prod = dbProducts.find((p) => p.id === i.productId);
              let stage = 'MAIN';
              if (prod?.category?.name) {
                const catName = prod.category.name.toLowerCase();
                if (catName.includes('bebid') || catName.includes('drink') || catName.includes('trago')) stage = 'DRINK';
                else if (catName.includes('entrad') || catName.includes('aperitiv') || catName.includes('starter')) stage = 'STARTER';
                else if (catName.includes('postre') || catName.includes('dessert') || catName.includes('dulce')) stage = 'DESSERT';
              }
              return {
                productId: i.productId,
                quantity: i.quantity,
                price: i.price,
                notes: i.notes,
                modifiers: i.modifiers,
                status: 'PENDING',
                serviceStage: stage,
              };
            }),
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

      // If paid via gift card or monedero, debit atomically
      if (isGiftCardPay && giftCardCode) {
        const cleanCardCode = String(giftCardCode).trim().toUpperCase();
        const card = await tx.giftCard.findFirst({
          where: { 
            OR: [{ code: cleanCardCode }, { id: cleanCardCode }],
            brandId: brand.id,
          },
        });

        if (!card) {
          throw new Error('Tarjeta de regalo o monedero no encontrado en este restaurante');
        }
        if (card.status === 'BLOCKED') {
          throw new Error('La tarjeta de regalo o monedero está bloqueada para transacciones');
        }
        if (card.status === 'EXPIRED' || (card.expiresAt && new Date() > new Date(card.expiresAt))) {
          throw new Error('La tarjeta de regalo o monedero ha expirado');
        }
        if (card.pin && String(giftCardPin).trim() !== card.pin) {
          throw new Error('PIN de seguridad incorrecto para esta tarjeta de regalo');
        }

        const debitAmount = Math.min(card.balance, total);
        if (debitAmount <= 0) {
          throw new Error('La tarjeta de regalo no tiene saldo suficiente ($0.00)');
        }

        const newBalance = parseFloat((card.balance - debitAmount).toFixed(2));
        const newStatus = newBalance <= 0 ? 'DEPLETED' : 'ACTIVE';

        await tx.giftCard.update({
          where: { id: card.id },
          data: {
            balance: newBalance,
            status: newStatus,
          },
        });

        await tx.giftCardTransaction.create({
          data: {
            giftCardId: card.id,
            type: 'REDEMPTION',
            amount: debitAmount,
            balanceBefore: card.balance,
            balanceAfter: newBalance,
            orderId: createdOrder.id,
            notes: `Pago de pedido ${createdOrder.orderNumber} en línea`,
          },
        });

        await tx.paymentTransaction.create({
          data: {
            orderId: createdOrder.id,
            brandId: brand.id,
            amount: debitAmount,
            gateway: 'GIFT_CARD',
            status: 'COMPLETED',
            gatewayPaymentId: `GC-${card.code}-${Date.now()}`,
          },
        });
      }

      // Record cashback credit transaction if customer is registered and cashback earned
      if (actualCashbackEarned > 0 && customerId) {
        await tx.customerWalletTransaction.create({
          data: {
            customerId,
            brandId: brand.id,
            orderId: createdOrder.id,
            type: 'EARNED_CASHBACK',
            amount: actualCashbackEarned,
            balanceBefore: initialWalletBal,
            balanceAfter: parseFloat((initialWalletBal + actualCashbackEarned).toFixed(2)),
            reference: `Cashback Pedido #${orderNumber}`,
            notes: 'Cashback acreditado automáticamente por comanda digital',
            createdByName: 'Menú Digital QR',
          },
        });
      }

      return createdOrder;
    });

    // 5. If online payment (STRIPE / MERCADOPAGO), generate payment session
    let paymentSession = null;
    if (paymentMethod === 'STRIPE' || paymentMethod === 'MERCADOPAGO') {
      try {
        paymentSession = await createPaymentSession({
          orderId: order.id,
          gateway: paymentMethod,
          customerEmail: undefined,
          req: request,
        });
      } catch (err) {
        console.error('Error initiating payment session for public order:', err);
      }
    }

    // 6. Emit real-time SSE event to trigger Kitchen KDS and bell sound!
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
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        total: order.total,
        createdAt: order.createdAt,
      },
      paymentSession,
    });
  } catch (error) {
    console.error('Error creating public order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar el pedido' },
      { status: 500 }
    );
  }
}
