import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, amount, orderId, pin, notes, userId } = body;

    if (!code) {
      return NextResponse.json({ error: 'Código de tarjeta o monedero requerido' }, { status: 400 });
    }

    const debitAmount = parseFloat(String(amount));
    if (isNaN(debitAmount) || debitAmount <= 0) {
      return NextResponse.json({ error: 'El monto a redimir debe ser mayor a cero' }, { status: 400 });
    }

    const cleanCode = String(code).trim().toUpperCase();

    const card = await prisma.giftCard.findFirst({
      where: {
        OR: [{ code: cleanCode }, { id: code }],
      },
      include: {
        customer: true,
      },
    });

    if (!card) {
      return NextResponse.json({ error: 'Tarjeta de regalo o monedero no encontrado' }, { status: 404 });
    }

    if (card.status === 'BLOCKED') {
      return NextResponse.json({ error: 'La tarjeta está bloqueada para transacciones' }, { status: 400 });
    }

    if (card.status === 'EXPIRED' || (card.expiresAt && new Date() > new Date(card.expiresAt))) {
      return NextResponse.json({ error: 'La tarjeta ha expirado' }, { status: 400 });
    }

    // Verify PIN if configured on card
    if (card.pin && String(pin).trim() !== card.pin) {
      return NextResponse.json({ error: 'El PIN de seguridad de la tarjeta es incorrecto' }, { status: 401 });
    }

    if (card.balance < debitAmount) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente. Saldo disponible: $${card.balance.toFixed(2)}, monto solicitado: $${debitAmount.toFixed(2)}`,
          availableBalance: card.balance,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const balanceBefore = card.balance;
      const balanceAfter = parseFloat((balanceBefore - debitAmount).toFixed(2));
      const nextStatus = balanceAfter <= 0 ? 'DEPLETED' : 'ACTIVE';

      const updatedCard = await tx.giftCard.update({
        where: { id: card.id },
        data: {
          balance: balanceAfter,
          status: nextStatus,
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      const cardTx = await tx.giftCardTransaction.create({
        data: {
          giftCardId: card.id,
          type: 'DEBIT',
          amount: debitAmount,
          balanceBefore,
          balanceAfter,
          orderId: orderId || null,
          notes: notes ? notes.trim() : orderId ? `Pago de comanda #${orderId.slice(0, 8)}` : 'Cobro con tarjeta de regalo',
          createdById: userId || null,
        },
      });

      let updatedOrder = null;
      if (orderId) {
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (order) {
          const newPaidAmount = parseFloat(((order.paidAmount || 0) + debitAmount).toFixed(2));
          const isFullyPaid = newPaidAmount >= order.total - 0.01;

          updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
              paidAmount: newPaidAmount,
              paymentStatus: isFullyPaid ? 'PAID' : 'PARTIAL',
              paymentMethod: order.paymentMethod ? `${order.paymentMethod}, MONEDERO` : 'MONEDERO',
              paidAt: isFullyPaid ? new Date() : order.paidAt,
              status: isFullyPaid && order.status === 'RECEIVED' ? 'PREPARING' : order.status,
            },
          });

          // Create payment transaction record for audit and reporting
          await tx.paymentTransaction.create({
            data: {
              orderId: order.id,
              brandId: order.brandId,
              gateway: 'GIFT_CARD',
              status: 'PAID',
              amount: debitAmount,
              currency: 'MXN',
              method: 'MONEDERO_ELECTRONICO',
              notes: `Tarjeta: ${card.code}`,
            },
          });
        }
      }

      return {
        card: updatedCard,
        cardTransaction: cardTx,
        order: updatedOrder,
      };
    });

    return NextResponse.json({
      success: true,
      card: result.card,
      transaction: result.cardTransaction,
      order: result.order,
      message: `Pago de $${debitAmount.toFixed(2)} procesado exitosamente con Monedero/Gift Card. Saldo restante: $${result.card.balance.toFixed(2)}`,
    });
  } catch (error: any) {
    console.error('Error redeeming gift card:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar pago con tarjeta de regalo' }, { status: 500 });
  }
}
