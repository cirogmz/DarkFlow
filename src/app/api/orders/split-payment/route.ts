import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, amount, tip = 0, method = 'CASH', splitIndex = 1, customerName, notes } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden requerido' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Monto de pago inválido' }, { status: 400 });
    }

    const numTip = Math.max(0, parseFloat(tip) || 0);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: { include: { product: true } },
        paymentTransactions: true,
      },
    });

    if (!order || order.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'Esta orden ya se encuentra totalmente liquidada' }, { status: 400 });
    }

    const currentPaid = order.paidAmount || 0;
    const newPaidAmount = parseFloat((currentPaid + numAmount).toFixed(2));
    const newTotalTip = parseFloat(((order.tip || 0) + numTip).toFixed(2));
    const remainingBalance = Math.max(0, parseFloat((order.total - newPaidAmount).toFixed(2)));
    const isFullyPaid = newPaidAmount >= (order.total - 0.05);

    // Create payment transaction
    const transaction = await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        brandId: order.brandId,
        gateway: method === 'STRIPE' ? 'STRIPE' : method === 'MERCADOPAGO' ? 'MERCADOPAGO' : 'MANUAL',
        status: 'COMPLETED',
        amount: numAmount,
        tip: numTip,
        currency: 'MXN',
        method,
        splitIndex: parseInt(splitIndex, 10) || 1,
        notes: notes || (customerName ? `Comensal: ${customerName}` : `Pago parcial #${splitIndex || 1}`),
      },
    });

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paidAmount: newPaidAmount,
        tip: newTotalTip,
        paymentStatus: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
        paidAt: isFullyPaid ? new Date() : order.paidAt,
        status: isFullyPaid ? 'DELIVERED' : order.status,
      },
      include: {
        table: true,
        items: { include: { product: true } },
        paymentTransactions: true,
      },
    });

    // If fully paid and has table, free the table
    if (isFullyPaid && order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' },
      });
    }

    // Emit reactive events
    orderEvents.emit('order_event', {
      action: isFullyPaid ? 'PAID' : 'UPDATED',
      orderId: updatedOrder.id,
      brandId: session.activeBrandId,
      orderNumber: updatedOrder.orderNumber,
      isFullyPaid,
      paidAmount: newPaidAmount,
      remainingBalance,
      message: isFullyPaid
        ? `Orden #${updatedOrder.orderNumber} liquidada totalmente`
        : `Abono de $${numAmount.toFixed(2)} registrado en Orden #${updatedOrder.orderNumber} (Resta: $${remainingBalance.toFixed(2)})`,
    });

    await recordAuditLog({
      action: isFullyPaid ? 'ORDER_PAID' : 'ORDER_SPLIT_PAYMENT',
      entityType: 'ORDER',
      entityId: updatedOrder.id,
      details: {
        orderNumber: updatedOrder.orderNumber,
        splitIndex,
        paymentMethod: method,
        amountPaid: numAmount,
        tipPaid: numTip,
        totalOrder: updatedOrder.total,
        accumulatedPaid: newPaidAmount,
        remainingBalance,
        isFullyPaid,
      },
      severity: isFullyPaid ? 'INFO' : 'INFO',
      brandId: session.activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      isFullyPaid,
      paidAmount: newPaidAmount,
      remainingBalance,
      tipTotal: newTotalTip,
      transaction,
      order: updatedOrder,
      message: isFullyPaid ? 'Cuenta totalmente liquidada' : 'Abono registrado con éxito',
    });
  } catch (error: unknown) {
    console.error('Error processing split payment:', error);
    return NextResponse.json({ error: 'Error interno al registrar pago parcial' }, { status: 500 });
  }
}
