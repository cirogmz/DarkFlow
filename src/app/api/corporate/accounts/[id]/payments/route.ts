import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { generateReceiptFolio } from '@/lib/corporateCredit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: accountId } = await params;
    const body = await req.json();
    const {
      amount,
      paymentMethod = 'SPEI',
      bankReference,
      notes,
    } = body;

    const paymentAmount = parseFloat(String(amount));
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'El monto del abono debe ser mayor a $0.00 MXN' }, { status: 400 });
    }

    const account = await prisma.corporateCreditAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta corporativa no encontrada' }, { status: 404 });
    }

    const balanceBefore = account.currentBalance;
    const balanceAfter = Math.max(0, Math.round((balanceBefore - paymentAmount) * 100) / 100);
    const newAvailableCredit = Math.max(0, Math.round((account.creditLimit - balanceAfter) * 100) / 100);

    const receiptFolio = generateReceiptFolio();

    // Determinar nuevo estado (si estaba OVER_LIMIT y ahora está dentro de margen, reactivar)
    let newStatus = account.status;
    if (account.status === 'OVER_LIMIT' && balanceAfter <= account.creditLimit) {
      newStatus = 'ACTIVE';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Crear el registro de abono
      const payment = await tx.corporateCreditPayment.create({
        data: {
          accountId,
          receiptFolio,
          amount: paymentAmount,
          paymentMethod,
          bankReference: bankReference ? bankReference.trim() : null,
          balanceBefore,
          balanceAfter,
          receivedById: session.userId || null,
          receivedByName: session.name || 'Cajero / Administrador',
          notes: notes ? notes.trim() : null,
        },
      });

      // 2. Actualizar balance de la cuenta
      const updatedAccount = await tx.corporateCreditAccount.update({
        where: { id: accountId },
        data: {
          currentBalance: balanceAfter,
          availableCredit: newAvailableCredit,
          status: newStatus,
        },
      });

      // 3. Si el saldo llega a 0, marcar todos los vales pendientes como SETTLED
      if (balanceAfter === 0) {
        await tx.corporateCreditVoucher.updateMany({
          where: {
            accountId,
            status: 'PENDING',
          },
          data: {
            status: 'SETTLED',
          },
        });
      }

      return { payment, updatedAccount };
    });

    return NextResponse.json({
      payment: result.payment,
      account: result.updatedAccount,
      message: `Abono de $${paymentAmount.toFixed(2)} MXN registrado con folio ${receiptFolio}. Saldo actual: $${balanceAfter.toFixed(2)} MXN`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error registering corporate payment:', error);
    return NextResponse.json({ error: 'Error al registrar abono a cuenta corporativa' }, { status: 500 });
  }
}
