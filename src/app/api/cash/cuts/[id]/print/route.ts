import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCutTicketText, CutSummaryData } from '@/lib/cashCuts';
import { generateRawTicketBuffer, sendToNetworkPrinter } from '@/lib/escpos';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { printerId } = body;

    const cut = await prisma.cashCut.findUnique({
      where: { id },
      include: {
        cashSession: {
          include: {
            brand: true,
            user: true,
          },
        },
      },
    });

    if (!cut || cut.cashSession.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Corte no encontrado' }, { status: 404 });
    }

    // Find printer
    let printer = null;
    if (printerId) {
      printer = await prisma.printer.findFirst({
        where: { id: printerId, brandId: session.activeBrandId },
      });
    }

    if (!printer) {
      // Find first CASHIER, CAJA, or general printer
      printer = await prisma.printer.findFirst({
        where: {
          brandId: session.activeBrandId,
          isActive: true,
          targetStation: { in: ['CASHIER', 'CAJA', 'RECEIPT', 'ALL'] },
        },
      });
    }

    if (!printer) {
      printer = await prisma.printer.findFirst({
        where: {
          brandId: session.activeBrandId,
          isActive: true,
        },
      });
    }

    if (!printer) {
      return NextResponse.json(
        { error: 'No hay ninguna impresora de caja configurada para esta marca' },
        { status: 400 }
      );
    }

    let parsedDenominations = null;
    if (cut.denominations) {
      try {
        parsedDenominations = JSON.parse(cut.denominations);
      } catch {
        parsedDenominations = null;
      }
    }

    const ticketData: CutSummaryData = {
      cutType: cut.cutType as 'CORTE_X' | 'CORTE_Z',
      cutNumber: cut.cutNumber,
      consecutive: cut.consecutive,
      brandName: cut.cashSession.brand.name,
      brandRfc: null,
      brandAddress: null,
      branchName: null,
      openedAt: cut.openedAt,
      cutAt: cut.cutAt,
      cashierName: cut.createdByName || cut.cashSession.user.name,
      openingBalance: cut.openingBalance,
      cashSales: cut.cashSales,
      cardSales: cut.cardSales,
      appsSales: cut.appsSales,
      giftCardSales: cut.giftCardSales,
      transfersSales: cut.transfersSales,
      totalSales: cut.totalSales,
      cashInTotal: cut.cashInTotal,
      cashOutTotal: cut.cashOutTotal,
      expectedCash: cut.expectedCash,
      declaredCash: cut.declaredCash,
      cashDifference: cut.cashDifference,
      declaredCard: cut.declaredCard,
      declaredOther: cut.declaredOther,
      totalDeclared: cut.totalDeclared,
      totalDifference: cut.totalDifference,
      ordersCount: cut.ordersCount,
      discountsTotal: cut.discountsTotal,
      canceledOrdersCount: cut.canceledOrdersCount,
      canceledAmount: cut.canceledAmount,
      tipsTotal: cut.tipsTotal,
      tipsCash: cut.tipsCash,
      tipsCard: cut.tipsCard,
      denominations: parsedDenominations,
      notes: cut.notes,
    };

    const ticketText = generateCutTicketText(ticketData);
    const buffer = generateRawTicketBuffer(ticketText);

    const printResult = await sendToNetworkPrinter(
      printer.ipAddress,
      printer.port,
      buffer,
      4000
    );

    if (printResult.success) {
      await prisma.cashCut.update({
        where: { id: cut.id },
        data: { printedAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        message: `Ticket impreso en ${printer.name} (${printer.ipAddress}:${printer.port})`,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: printResult.error || 'Fallo de conexión con la impresora',
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Error printing cut ticket:', error);
    return NextResponse.json({ error: 'Error al imprimir ticket de corte' }, { status: 500 });
  }
}
