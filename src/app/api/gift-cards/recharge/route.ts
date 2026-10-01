import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, amount, notes, userId, paymentMethod } = body;

    if (!code) {
      return NextResponse.json({ error: 'Código de tarjeta requerido' }, { status: 400 });
    }

    const rechargeAmount = parseFloat(String(amount));
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      return NextResponse.json({ error: 'El monto a recargar debe ser mayor a cero' }, { status: 400 });
    }

    const cleanCode = String(code).trim().toUpperCase();

    const card = await prisma.giftCard.findFirst({
      where: {
        OR: [{ code: cleanCode }, { id: code }],
      },
    });

    if (!card) {
      return NextResponse.json({ error: 'Tarjeta de regalo no encontrada' }, { status: 404 });
    }

    if (card.status === 'BLOCKED') {
      return NextResponse.json({ error: 'La tarjeta está bloqueada. Desbloquéala antes de recargar.' }, { status: 400 });
    }

    if (card.status === 'EXPIRED' || (card.expiresAt && new Date() > new Date(card.expiresAt))) {
      return NextResponse.json({ error: 'La tarjeta ha expirado' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const balanceBefore = card.balance;
      const balanceAfter = parseFloat((balanceBefore + rechargeAmount).toFixed(2));

      const updatedCard = await tx.giftCard.update({
        where: { id: card.id },
        data: {
          balance: balanceAfter,
          status: 'ACTIVE',
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      const transaction = await tx.giftCardTransaction.create({
        data: {
          giftCardId: card.id,
          type: 'RECHARGE',
          amount: rechargeAmount,
          balanceBefore,
          balanceAfter,
          notes: notes
            ? `${notes.trim()}${paymentMethod ? ` [Método: ${paymentMethod}]` : ''}`
            : `Recarga de saldo${paymentMethod ? ` vía ${paymentMethod}` : ''}`,
          createdById: userId || null,
        },
      });

      return { card: updatedCard, transaction };
    });

    return NextResponse.json({
      success: true,
      card: result.card,
      transaction: result.transaction,
      message: `Recarga de $${rechargeAmount.toFixed(2)} aplicada exitosamente. Nuevo saldo: $${result.card.balance.toFixed(2)}`,
    });
  } catch (error: any) {
    console.error('Error recharging gift card:', error);
    return NextResponse.json({ error: error.message || 'Error al recargar saldo en tarjeta' }, { status: 500 });
  }
}
