import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { calculateReturnMetrics } from '@/lib/dishReturns';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const url = new URL(req.url);
    const attribution = url.searchParams.get('attribution');
    const reason = url.searchParams.get('reason');
    const orderId = url.searchParams.get('orderId');

    const where: any = { brandId: activeBrandId };
    if (attribution && attribution !== 'ALL') where.attribution = attribution;
    if (reason && reason !== 'ALL') where.returnReason = reason;
    if (orderId) where.orderId = orderId;

    const returns = await prisma.dishReturnLog.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            table: { select: { number: true, name: true } },
            source: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const metrics = calculateReturnMetrics(returns);

    return NextResponse.json({
      success: true,
      returns,
      metrics,
    });
  } catch (error: unknown) {
    console.error('Error fetching dish returns:', error);
    return NextResponse.json({ error: 'Error al obtener bitácora de devoluciones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      orderId,
      orderItemId,
      productName,
      returnReason,
      attribution = 'KITCHEN',
      resolution = 'RECOOK',
      quantity = 1,
      price = 0,
      estimatedFoodCost = 0,
      guestCompType = 'NONE',
      guestCompAmount = 0,
      tableNumber,
      waiterName,
      supervisorPin,
      notes,
    } = body;

    if (!orderId || !productName || !returnReason) {
      return NextResponse.json(
        { error: 'Comanda, nombre de platillo y motivo de devolución son obligatorios' },
        { status: 400 }
      );
    }

    // Optional PIN verification if provided
    let verifiedSupervisorName = session.name || 'Gerente';
    if (supervisorPin) {
      const pinUser = await prisma.user.findFirst({
        where: {
          pinCode: String(supervisorPin).trim(),
          role: { in: ['SUPER_ADMIN', 'BRAND_ADMIN', 'CASHIER'] },
          brands: { some: { brandId: activeBrandId } },
        },
        select: { id: true, name: true, role: true },
      });

      if (!pinUser) {
        return NextResponse.json({ error: 'PIN de supervisor inválido o no autorizado' }, { status: 403 });
      }
      verifiedSupervisorName = pinUser.name;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, brandId: activeBrandId },
      include: {
        table: true,
        items: true,
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 });
    }

    const returnQty = Math.max(1, parseInt(String(quantity), 10) || 1);
    const itemPrice = parseFloat(String(price)) || 0;
    const foodCost = parseFloat(String(estimatedFoodCost)) || (itemPrice * 0.3); // 30% default food cost

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create DishReturnLog
      const returnLog = await tx.dishReturnLog.create({
        data: {
          brandId: activeBrandId,
          orderId,
          orderItemId: orderItemId || null,
          productName: productName.trim(),
          tableNumber: tableNumber || order.table?.number || null,
          waiterName: waiterName || null,
          returnReason,
          attribution,
          resolution,
          quantity: returnQty,
          price: itemPrice,
          estimatedFoodCost: Math.round(foodCost * 100) / 100,
          wasteLogged: true,
          guestCompType,
          guestCompAmount: parseFloat(String(guestCompAmount)) || 0,
          recookTriggered: resolution === 'RECOOK',
          supervisorName: verifiedSupervisorName,
          notes: notes?.trim() || null,
        },
      });

      // 2. Update OrderItem if specified
      if (orderItemId) {
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            isReturned: true,
            returnReason,
          },
        });
      }

      // 3. Update Order counters
      await tx.order.update({
        where: { id: orderId },
        data: {
          hasDishReturns: true,
          dishReturnsCount: { increment: returnQty },
        },
      });

      // 4. If Resolution is REMOVE_FROM_BILL: reduce order subtotal and total
      if (resolution === 'REMOVE_FROM_BILL') {
        const deduction = itemPrice * returnQty;
        const newSubtotal = Math.max(0, order.subtotal - deduction);
        const newTotal = Math.max(0, order.total - deduction);

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: Math.round(newSubtotal * 100) / 100,
            total: Math.round(newTotal * 100) / 100,
          },
        });
      }

      // 5. If Guest Compensation is WALLET_CASHBACK and Customer exists: credit wallet
      if (guestCompType === 'WALLET_CASHBACK' && order.customerId && guestCompAmount > 0) {
        const compAmt = parseFloat(String(guestCompAmount)) || 0;
        const currentBalance = order.customer?.walletBalance || 0;

        await tx.customer.update({
          where: { id: order.customerId },
          data: { walletBalance: { increment: compAmt } },
        });

        await tx.customerWalletTransaction.create({
          data: {
            brandId: activeBrandId,
            customerId: order.customerId,
            orderId: order.id,
            type: 'REFUND_ADJUSTMENT',
            amount: compAmt,
            balanceBefore: currentBalance,
            balanceAfter: currentBalance + compAmt,
            notes: `Compensación de Cortesía por Devolución: ${productName}`,
            createdByName: verifiedSupervisorName,
          },
        });
      }

      return returnLog;
    });

    await recordAuditLog({
      action: 'DISH_RETURN_LOGGED',
      entityType: 'ORDER',
      entityId: orderId,
      details: {
        productName,
        returnReason,
        attribution,
        resolution,
        quantity: returnQty,
        supervisorName: verifiedSupervisorName,
      },
      severity: attribution === 'KITCHEN' ? 'WARNING' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, dishReturn: result });
  } catch (error: unknown) {
    console.error('Error logging dish return:', error);
    return NextResponse.json({ error: 'Error al registrar la devolución del platillo' }, { status: 500 });
  }
}
