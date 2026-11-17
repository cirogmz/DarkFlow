import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { generateStatementReportText } from '@/lib/corporateCredit';

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

    const { id } = await params;

    const statement = await prisma.corporateAccountStatement.findUnique({
      where: { id },
      include: {
        account: {
          include: { brand: true },
        },
        vouchers: {
          include: {
            order: {
              select: { orderNumber: true },
            },
          },
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }

    // Buscar abonos en el periodo
    const payments = await prisma.corporateCreditPayment.findMany({
      where: {
        accountId: statement.accountId,
        createdAt: {
          gte: statement.periodStart,
          lte: statement.periodEnd,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const brandName = statement.account.brand?.name || 'DarkFlow Gastronomía';

    const report = generateStatementReportText({
      brandName,
      account: {
        accountNumber: statement.account.accountNumber,
        companyName: statement.account.companyName,
        tradeName: statement.account.tradeName,
        rfc: statement.account.rfc,
        billingAddress: statement.account.billingAddress,
        contactName: statement.account.contactName,
        contactPhone: statement.account.contactPhone,
        creditLimit: statement.account.creditLimit,
        paymentTermsDays: statement.account.paymentTermsDays,
      },
      statement: {
        statementFolio: statement.statementFolio,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        previousBalance: statement.previousBalance,
        chargesAmount: statement.chargesAmount,
        paymentsAmount: statement.paymentsAmount,
        closingBalance: statement.closingBalance,
        dueDate: statement.dueDate,
        status: statement.status,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vouchers: statement.vouchers.map((v: any) => ({
        voucherFolio: v.voucherFolio,
        amount: v.amount,
        signedByName: v.signedByName,
        employeeId: v.employeeId,
        department: v.department,
        createdAt: v.createdAt,
        orderNumber: v.order?.orderNumber || null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payments: payments.map((p: any) => ({
        receiptFolio: p.receiptFolio,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        bankReference: p.bankReference,
        createdAt: p.createdAt,
      })),
    });

    return NextResponse.json({
      report,
      statement,
    });
  } catch (error) {
    console.error('Error generating statement report print:', error);
    return NextResponse.json({ error: 'Error al generar reporte de estado de cuenta' }, { status: 500 });
  }
}
