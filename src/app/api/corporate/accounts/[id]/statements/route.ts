import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { generateStatementFolio } from '@/lib/corporateCredit';

export async function GET(
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

    const statements = await prisma.corporateAccountStatement.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      include: {
        vouchers: {
          select: {
            id: true,
            voucherFolio: true,
            amount: true,
            signedByName: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ statements });
  } catch (error) {
    console.error('Error fetching statements:', error);
    return NextResponse.json({ error: 'Error al consultar estados de cuenta' }, { status: 500 });
  }
}

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
    const { periodStart, periodEnd, notes } = body;

    const account = await prisma.corporateCreditAccount.findUnique({
      where: { id: accountId },
      include: { brand: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta corporativa no encontrada' }, { status: 404 });
    }

    const startDate = periodStart ? new Date(periodStart) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const endDate = periodEnd ? new Date(periodEnd) : new Date();

    // Fecha límite de pago = fin de periodo + días de crédito acordados
    const dueDate = new Date(endDate.getTime() + account.paymentTermsDays * 24 * 3600 * 1000);

    // Buscar vales emitidos en el periodo
    const vouchersInPeriod = await prisma.corporateCreditVoucher.findMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chargesAmount = vouchersInPeriod.reduce((sum: number, v: any) => sum + (v.amount || 0), 0);

    // Buscar abonos registrados en el periodo
    const paymentsInPeriod = await prisma.corporateCreditPayment.findMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentsAmount = paymentsInPeriod.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Obtener saldo anterior al periodo
    const previousVouchers = await prisma.corporateCreditVoucher.aggregate({
      where: {
        accountId,
        createdAt: { lt: startDate },
      },
      _sum: { amount: true },
    });
    const previousPayments = await prisma.corporateCreditPayment.aggregate({
      where: {
        accountId,
        createdAt: { lt: startDate },
      },
      _sum: { amount: true },
    });

    const previousCharges = previousVouchers._sum.amount || 0;
    const previousPaid = previousPayments._sum.amount || 0;
    const previousBalance = Math.max(0, previousCharges - previousPaid);

    const closingBalance = Math.max(0, Math.round((previousBalance + chargesAmount - paymentsAmount) * 100) / 100);

    const statementFolio = generateStatementFolio(account.accountNumber);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Crear el Estado de Cuenta
      const statement = await tx.corporateAccountStatement.create({
        data: {
          accountId,
          statementFolio,
          periodStart: startDate,
          periodEnd: endDate,
          previousBalance,
          chargesAmount,
          paymentsAmount,
          closingBalance,
          dueDate,
          status: closingBalance === 0 ? 'PAID' : 'GENERATED',
          notes: notes ? notes.trim() : null,
        },
      });

      // 2. Asociar los vales del periodo a este estado de cuenta
      if (vouchersInPeriod.length > 0) {
        await tx.corporateCreditVoucher.updateMany({
          where: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: { in: vouchersInPeriod.map((v: any) => v.id) },
          },
          data: {
            statementId: statement.id,
          },
        });
      }

      return statement;
    });

    return NextResponse.json({
      statement: result,
      message: `Estado de Cuenta ${statementFolio} generado con éxito con saldo al corte de $${closingBalance.toFixed(2)} MXN`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating corporate statement:', error);
    return NextResponse.json({ error: 'Error al generar estado de cuenta' }, { status: 500 });
  }
}
