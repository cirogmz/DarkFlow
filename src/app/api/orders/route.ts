import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { orderEvents } from '@/lib/events';
import { createPaymentSession } from '@/lib/payments';
import { generateKotBuffer, sendToNetworkPrinter } from '@/lib/escpos';
import { determineCustomerTier, calculateLoyaltyPointsEarned } from '@/lib/loyaltyTiers';

interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
  notes?: string | null;
  modifiers?: unknown;
  serviceStage?: string | null;
  status?: string;
  allergenAlert?: string | null;
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
        waiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
      giftCardCode,
      giftCardPin,
      paymentMethod = 'CASH',
      paymentStatus: explicitPaymentStatus,
      items
    } = await req.json();

    const isGiftCardPay = paymentMethod === 'GIFT_CARD' || paymentMethod === 'MONEDERO';
    const isDirectPaid = explicitPaymentStatus === 'PAID' || (!explicitPaymentStatus && (paymentMethod === 'CASH' || paymentMethod === 'CARD' || isGiftCardPay));
    const finalPaymentStatus = explicitPaymentStatus || (isDirectPaid ? 'PAID' : 'PENDING');
    const finalPaidAt = isDirectPaid ? new Date() : null;

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

    // Fetch products info to compute order prepTimeTarget (SLA) and default serviceStage
    const productIds = typedItems.map((i) => i.productId);
    const productsInfo = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, targetPrepTime: true, category: { select: { name: true } } },
    });
    const prodMap = new Map(productsInfo.map((p) => [p.id, p]));
    const calculatedSla = productsInfo.reduce((max, p) => Math.max(max, p.targetPrepTime || 10), 10);

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
          const updatedTotalSpent = existingCustomer.totalSpent + total;
          const updatedTotalOrders = existingCustomer.totalOrders + 1;
          const newTier = determineCustomerTier(updatedTotalSpent, updatedTotalOrders);
          const earned = calculateLoyaltyPointsEarned(total, existingCustomer.pointsMultiplier || newTier.pointsMultiplier);
          const newPoints = Math.max(0, existingCustomer.loyaltyPoints - numRedeemedPoints + earned);

          await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: customerName.trim(),
              address: customerAddress ? customerAddress.trim() : existingCustomer.address,
              totalOrders: { increment: 1 },
              totalSpent: { increment: total },
              loyaltyPoints: newPoints,
              tier: newTier.id,
              pointsMultiplier: newTier.pointsMultiplier,
              tierDiscountPct: newTier.discountPct,
            },
          });
        } else {
          const newTier = determineCustomerTier(total, 1);
          const earned = calculateLoyaltyPointsEarned(total, newTier.pointsMultiplier);
          const newCustomer = await tx.customer.create({
            data: {
              name: customerName.trim(),
              phone: cleanPhone,
              address: customerAddress ? customerAddress.trim() : null,
              brandId: activeBrandId,
              totalOrders: 1,
              totalSpent: total,
              loyaltyPoints: Math.max(0, earned - numRedeemedPoints),
              tier: newTier.id,
              pointsMultiplier: newTier.pointsMultiplier,
              tierDiscountPct: newTier.discountPct,
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
          paymentMethod,
          paymentStatus: finalPaymentStatus,
          paidAt: finalPaidAt,
          prepTimeTarget: calculatedSla,
          currentStage: 'STARTER',
          items: {
            create: typedItems.map((item) => {
              const p = prodMap.get(item.productId);
              let detectedStage = item.serviceStage;
              if (!detectedStage && p?.category?.name) {
                const catName = p.category.name.toLowerCase();
                if (catName.includes('bebid') || catName.includes('drink') || catName.includes('trago') || catName.includes('refresco')) {
                  detectedStage = 'DRINK';
                } else if (catName.includes('entrad') || catName.includes('aperitiv') || catName.includes('starter') || catName.includes('botana')) {
                  detectedStage = 'STARTER';
                } else if (catName.includes('postre') || catName.includes('dessert') || catName.includes('dulce') || catName.includes('helado')) {
                  detectedStage = 'DESSERT';
                } else {
                  detectedStage = 'MAIN';
                }
              }
              return {
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                notes: item.notes || null,
                modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers)) : null,
                status: item.status || 'PENDING',
                serviceStage: detectedStage || 'MAIN',
                allergenAlert: item.allergenAlert || null,
              };
            }),
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

      // If paid via gift card or monedero, debit atomically
      if (isGiftCardPay && giftCardCode) {
        const cleanCardCode = String(giftCardCode).trim().toUpperCase();
        const card = await tx.giftCard.findFirst({
          where: { OR: [{ code: cleanCardCode }, { id: cleanCardCode }] },
        });

        if (!card) {
          throw new Error('Tarjeta de regalo o monedero no encontrado');
        }
        if (card.status === 'BLOCKED') {
          throw new Error('La tarjeta de regalo o monedero está bloqueada para transacciones');
        }
        if (card.status === 'EXPIRED' || (card.expiresAt && new Date() > new Date(card.expiresAt))) {
          throw new Error('La tarjeta de regalo o monedero ha expirado');
        }
        if (card.pin && String(giftCardPin).trim() !== card.pin) {
          throw new Error('El PIN de seguridad de la tarjeta de regalo es incorrecto');
        }
        if (card.balance < total) {
          throw new Error(
            `Saldo insuficiente en tarjeta. Saldo disponible: $${card.balance.toFixed(2)}, Total de comanda: $${total.toFixed(2)}`
          );
        }

        const balanceBefore = card.balance;
        const balanceAfter = parseFloat((balanceBefore - total).toFixed(2));
        await tx.giftCard.update({
          where: { id: card.id },
          data: {
            balance: balanceAfter,
            status: balanceAfter <= 0 ? 'DEPLETED' : 'ACTIVE',
          },
        });

        await tx.giftCardTransaction.create({
          data: {
            giftCardId: card.id,
            type: 'DEBIT',
            amount: total,
            balanceBefore,
            balanceAfter,
            orderId: newOrder.id,
            notes: `Pago comanda #${newOrder.orderNumber}`,
          },
        });

        // Set paidAmount on order and create PaymentTransaction
        await tx.order.update({
          where: { id: newOrder.id },
          data: {
            paidAmount: total,
            paymentStatus: 'PAID',
            paidAt: new Date(),
          },
        });

        await tx.paymentTransaction.create({
          data: {
            orderId: newOrder.id,
            brandId: activeBrandId,
            gateway: 'GIFT_CARD',
            status: 'PAID',
            amount: total,
            currency: 'MXN',
            method: 'MONEDERO_ELECTRONICO',
            notes: `Tarjeta: ${card.code}`,
          },
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

    // Silent automatic printing to configured network ESC/POS printers
    (async () => {
      try {
        const autoPrinters = await prisma.printer.findMany({
          where: {
            brandId: order.brandId,
            isActive: true,
            autoPrintTrigger: 'ON_ORDER_CREATED',
          },
        });

        if (autoPrinters.length > 0) {
          const brand = await prisma.brand.findUnique({ where: { id: order.brandId } });
          const processedOrder = {
            ...order,
            brand: brand || undefined,
            items: order.items.map((it: any) => {
              let parsedMods = [];
              if (it.modifiers) {
                try {
                  parsedMods = typeof it.modifiers === 'string' ? JSON.parse(it.modifiers) : it.modifiers;
                } catch {
                  parsedMods = [];
                }
              }
              return { ...it, selectedModifiers: parsedMods };
            }),
          };

          for (const p of autoPrinters) {
            if (p.connectionType === 'VIRTUAL') continue;
            const kot = generateKotBuffer(processedOrder, p);
            if (kot && kot.itemCount > 0) {
              sendToNetworkPrinter(p.ipAddress, p.port, kot.buffer).catch((err) =>
                console.error(`[AutoPrint] Error printing order to ${p.name}:`, err)
              );
            }
          }
        }
      } catch (printErr) {
        console.error('[AutoPrint] Error in auto-print background trigger:', printErr);
      }
    })();

    let paymentSession = null;
    if (paymentMethod === 'STRIPE' || paymentMethod === 'MERCADOPAGO') {
      try {
        paymentSession = await createPaymentSession({
          orderId: order.id,
          gateway: paymentMethod,
          req,
        });
      } catch (err) {
        console.error('Error generating payment session for POS order:', err);
      }
    }

    return NextResponse.json({ success: true, order, paymentSession });
  } catch (error: unknown) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
