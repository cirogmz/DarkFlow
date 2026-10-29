import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';
import { calculateOrderCashback, generateCustomerWalletQrCode } from '@/lib/wallet';
import { determineCustomerTier, calculateLoyaltyPointsEarned } from '@/lib/loyaltyTiers';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { id } = await params;
    const tableId = id;
    const { 
      paymentMethod = 'CASH', 
      tip = 0, 
      amountPaid,
      customerPhone,
      walletAmountPaid = 0 
    } = await req.json();

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          include: {
            customer: true,
            items: {
              include: {
                product: {
                  include: {
                    recipeItems: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!table || table.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    const activeOrder = table.orders[0];
    if (!activeOrder) {
      return NextResponse.json({ error: 'La mesa no tiene una comanda activa' }, { status: 400 });
    }

    const parsedTip = typeof tip === 'number' ? tip : parseFloat(String(tip || '0'));
    const finalTotal = activeOrder.total + parsedTip;
    const finalPaid = amountPaid ? parseFloat(String(amountPaid)) : finalTotal;
    const change = Math.max(0, finalPaid - finalTotal);

    await prisma.$transaction(async (tx) => {
      // Find customer if linked or passed phone
      let customer = activeOrder.customer;
      if (!customer && customerPhone && customerPhone.trim()) {
        customer = await tx.customer.findUnique({
          where: { phone: customerPhone.trim() },
        });
      }

      let actualWalletPaid = 0;
      let actualCashbackEarned = 0;
      let initialWalletBalance = 0;

      if (customer) {
        initialWalletBalance = customer.walletBalance;

        // Wallet redemption
        let reqWallet = parseFloat(String(walletAmountPaid)) || 0;
        if (paymentMethod === 'WALLET' && reqWallet === 0) {
          reqWallet = activeOrder.total;
        }
        if (reqWallet > 0) {
          actualWalletPaid = parseFloat(Math.min(reqWallet, customer.walletBalance, activeOrder.total).toFixed(2));
        }

        const outOfPocketPaid = Math.max(0, activeOrder.total - actualWalletPaid);
        const updatedTotalSpent = customer.totalSpent + activeOrder.total;
        const updatedTotalOrders = customer.totalOrders + 1;
        const newTier = determineCustomerTier(updatedTotalSpent, updatedTotalOrders);
        const earnedPoints = calculateLoyaltyPointsEarned(activeOrder.total, customer.pointsMultiplier || newTier.pointsMultiplier);

        if (outOfPocketPaid > 0) {
          const cb = calculateOrderCashback(outOfPocketPaid, newTier.id, customer.cashbackRatePct);
          actualCashbackEarned = cb.cashbackAmount;
        }

        const newWalletBalance = parseFloat((customer.walletBalance - actualWalletPaid + actualCashbackEarned).toFixed(2));

        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: activeOrder.total },
            loyaltyPoints: { increment: earnedPoints },
            tier: newTier.id,
            pointsMultiplier: newTier.pointsMultiplier,
            tierDiscountPct: newTier.discountPct,
            walletBalance: newWalletBalance,
            walletQrCode: customer.walletQrCode || generateCustomerWalletQrCode(customer.id),
            totalCashbackEarned: { increment: actualCashbackEarned },
            totalCashbackSpent: { increment: actualWalletPaid },
          },
        });
      }

      // 1. Close order
      await tx.order.update({
        where: { id: activeOrder.id },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          paymentMethod,
          tip: parsedTip,
          paidAmount: finalPaid,
          changeAmount: change,
          customerId: customer?.id || activeOrder.customerId,
          walletAmountPaid: actualWalletPaid,
          cashbackEarned: actualCashbackEarned,
          paidAt: new Date(),
        },
      });

      // 2. Free table
      await tx.table.update({
        where: { id: tableId },
        data: {
          status: 'AVAILABLE',
          assignedWaiterId: null,
        },
      });

      // 3. Deduct stock for all items in order
      for (const orderItem of activeOrder.items) {
        for (const recipeItem of orderItem.product.recipeItems) {
          const deductionQty = recipeItem.quantity * orderItem.quantity;
          await tx.ingredient.update({
            where: { id: recipeItem.ingredientId },
            data: {
              stock: { decrement: deductionQty },
            },
          });
        }
      }

      // 4. Record wallet transactions if applicable
      if (customer && actualWalletPaid > 0) {
        await tx.customerWalletTransaction.create({
          data: {
            customerId: customer.id,
            brandId: session.activeBrandId,
            orderId: activeOrder.id,
            type: 'REDEEMED_PAYMENT',
            amount: actualWalletPaid,
            balanceBefore: initialWalletBalance,
            balanceAfter: parseFloat((initialWalletBalance - actualWalletPaid).toFixed(2)),
            reference: `Pago Comanda #${activeOrder.orderNumber} (Mesa ${table.number})`,
            notes: 'Canje de monedero en cierre de mesa',
            createdById: session.userId,
            createdByName: session.name,
          },
        });
      }

      if (customer && actualCashbackEarned > 0) {
        const balBefore = parseFloat((initialWalletBalance - actualWalletPaid).toFixed(2));
        await tx.customerWalletTransaction.create({
          data: {
            customerId: customer.id,
            brandId: session.activeBrandId,
            orderId: activeOrder.id,
            type: 'EARNED_CASHBACK',
            amount: actualCashbackEarned,
            balanceBefore: balBefore,
            balanceAfter: parseFloat((balBefore + actualCashbackEarned).toFixed(2)),
            reference: `Cashback Comanda #${activeOrder.orderNumber}`,
            notes: 'Cashback por consumo en mesa',
            createdById: session.userId,
            createdByName: session.name,
          },
        });
      }
    });

    // Emit event
    orderEvents.emit('order_updated', {
      id: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      brandId: session.activeBrandId,
      tableNumber: table.number,
      status: 'COMPLETED',
      action: 'TABLE_CLOSED',
    });

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'WAITER_TABLE_CHECKOUT',
      entityType: 'Order',
      entityId: activeOrder.id,
      details: {
        tableNumber: table.number,
        orderNumber: activeOrder.orderNumber,
        total: activeOrder.total,
        tip: parsedTip,
        paymentMethod,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Mesa ${table.number} cobrada y liberada con éxito`,
      change,
    });
  } catch (error: unknown) {
    console.error('Error closing table in waiter pad:', error);
    return NextResponse.json({ error: 'Error al cobrar y cerrar mesa' }, { status: 500 });
  }
}
