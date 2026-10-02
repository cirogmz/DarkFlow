import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { calculateDenominationsTotal, generateCutTicketText, CutSummaryData } from '@/lib/cashCuts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();
    const { denominations, declaredCashManual, declaredCard = 0, declaredOther = 0, notes } = body;

    // Find active cash session
    const activeSession = await prisma.cashSession.findFirst({
      where: {
        brandId: activeBrandId,
        status: 'OPEN',
      },
      include: {
        brand: true,
        user: true,
      },
    });

    if (!activeSession) {
      return NextResponse.json({ error: 'No hay un turno de caja abierto para realizar el Corte Z' }, { status: 400 });
    }

    // Determine declared cash: either from denomination counting or manual input
    let declaredCash = 0;
    if (denominations && typeof denominations === 'object') {
      declaredCash = calculateDenominationsTotal(denominations);
    } else if (declaredCashManual !== undefined && !isNaN(parseFloat(declaredCashManual))) {
      declaredCash = parseFloat(declaredCashManual);
    }

    const parsedDeclaredCard = parseFloat(String(declaredCard)) || 0;
    const parsedDeclaredOther = parseFloat(String(declaredOther)) || 0;
    const totalDeclared = parseFloat((declaredCash + parsedDeclaredCard + parsedDeclaredOther).toFixed(2));

    // Fetch orders during the session timeframe
    const orders = await prisma.order.findMany({
      where: {
        brandId: activeBrandId,
        createdAt: {
          gte: activeSession.openedAt,
        },
      },
      include: {
        paymentTransactions: true,
      },
    });

    const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
    const canceledOrders = orders.filter((o) => o.status === 'CANCELLED');

    let cashSales = 0;
    let cardSales = 0;
    let appsSales = 0;
    let giftCardSales = 0;
    let transfersSales = 0;
    let tipsCash = 0;
    let tipsCard = 0;
    let discountsTotal = 0;

    completedOrders.forEach((order) => {
      const tipVal = order.tip || 0;
      discountsTotal += (order.discountAmount || 0);

      if (order.source === 'UBER_EATS' || order.source === 'RAPPI' || order.source === 'DIDI_FOOD') {
        appsSales += order.total;
      } else if (order.paymentMethod === 'GIFT_CARD' || order.paymentMethod === 'MONEDERO') {
        giftCardSales += order.total;
      } else if (order.paymentMethod === 'TRANSFERENCIA') {
        transfersSales += order.total;
      } else if (order.paymentMethod === 'CASH') {
        cashSales += order.total;
        tipsCash += tipVal;
      } else if (order.paymentMethod === 'TERMINAL' || order.paymentMethod === 'CARD' || order.paymentMethod === 'STRIPE' || order.paymentMethod === 'MERCADOPAGO') {
        cardSales += order.total;
        tipsCard += tipVal;
      } else if (order.source === 'WEB') {
        cardSales += order.total;
        tipsCard += tipVal;
      } else {
        cashSales += order.total;
        tipsCash += tipVal;
      }
    });

    const totalSales = parseFloat((cashSales + cardSales + appsSales + giftCardSales + transfersSales).toFixed(2));
    const tipsTotal = parseFloat((tipsCash + tipsCard).toFixed(2));

    // Fetch movements (inflows and sangrias)
    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: activeSession.id },
    });

    const cashInTotal = movements.filter((m) => m.type === 'IN').reduce((acc, m) => acc + m.amount, 0);
    const cashOutTotal = movements.filter((m) => m.type === 'OUT').reduce((acc, m) => acc + m.amount, 0);

    const expectedCash = parseFloat((activeSession.openingBalance + cashSales + cashInTotal - cashOutTotal).toFixed(2));
    const expectedTotal = parseFloat((expectedCash + cardSales + appsSales + giftCardSales + transfersSales).toFixed(2));

    const cashDifference = parseFloat((declaredCash - expectedCash).toFixed(2));
    const totalDifference = parseFloat((totalDeclared - expectedTotal).toFixed(2));

    const canceledOrdersCount = canceledOrders.length;
    const canceledAmount = canceledOrders.reduce((sum, o) => sum + o.total, 0);

    // Global consecutive Corte Z for the brand
    const previousZCutsCount = await prisma.cashCut.count({
      where: {
        cashSession: { brandId: activeBrandId },
        cutType: 'CORTE_Z',
      },
    });
    const consecutiveZ = previousZCutsCount + 1;
    const cutNumber = `Z-${String(consecutiveZ).padStart(4, '0')}`;
    const closeDate = new Date();

    // Execute atomic close and cut creation
    const { updatedSession, cashCut } = await prisma.$transaction(async (tx) => {
      const closedSession = await tx.cashSession.update({
        where: { id: activeSession.id },
        data: {
          closedAt: closeDate,
          closingBalance: declaredCash,
          expectedBalance: expectedCash,
          actualBalance: declaredCash,
          cashSales: parseFloat(cashSales.toFixed(2)),
          cardSales: parseFloat(cardSales.toFixed(2)),
          appsSales: parseFloat(appsSales.toFixed(2)),
          giftCardSales: parseFloat(giftCardSales.toFixed(2)),
          transfersSales: parseFloat(transfersSales.toFixed(2)),
          cashInTotal: parseFloat(cashInTotal.toFixed(2)),
          cashOutTotal: parseFloat(cashOutTotal.toFixed(2)),
          canceledTotal: parseFloat(canceledAmount.toFixed(2)),
          discountsTotal: parseFloat(discountsTotal.toFixed(2)),
          tipsTotal,
          tipsCash: parseFloat(tipsCash.toFixed(2)),
          tipsCard: parseFloat(tipsCard.toFixed(2)),
          consecutiveZ,
          blindCount: denominations ? JSON.stringify(denominations) : null,
          status: 'CLOSED',
          notes: notes || null,
        },
      });

      const newCut = await tx.cashCut.create({
        data: {
          cashSessionId: activeSession.id,
          cutType: 'CORTE_Z',
          cutNumber,
          consecutive: consecutiveZ,
          openedAt: activeSession.openedAt,
          cutAt: closeDate,
          openingBalance: activeSession.openingBalance,
          cashSales: parseFloat(cashSales.toFixed(2)),
          cardSales: parseFloat(cardSales.toFixed(2)),
          appsSales: parseFloat(appsSales.toFixed(2)),
          giftCardSales: parseFloat(giftCardSales.toFixed(2)),
          transfersSales: parseFloat(transfersSales.toFixed(2)),
          totalSales,
          cashInTotal: parseFloat(cashInTotal.toFixed(2)),
          cashOutTotal: parseFloat(cashOutTotal.toFixed(2)),
          expectedCash,
          expectedTotal,
          declaredCash,
          declaredCard: parsedDeclaredCard,
          declaredOther: parsedDeclaredOther,
          totalDeclared,
          cashDifference,
          totalDifference,
          denominations: denominations ? JSON.stringify(denominations) : null,
          ordersCount: completedOrders.length,
          discountsTotal: parseFloat(discountsTotal.toFixed(2)),
          canceledOrdersCount,
          canceledAmount: parseFloat(canceledAmount.toFixed(2)),
          tipsTotal,
          tipsCash: parseFloat(tipsCash.toFixed(2)),
          tipsCard: parseFloat(tipsCard.toFixed(2)),
          notes: notes || null,
          createdById: session.userId,
          createdByName: session.name,
        },
      });

      return { updatedSession: closedSession, cashCut: newCut };
    });

    const ticketData: CutSummaryData = {
      cutType: 'CORTE_Z',
      cutNumber,
      consecutive: consecutiveZ,
      brandName: activeSession.brand.name,
      brandRfc: null,
      brandAddress: null,
      branchName: null,
      openedAt: activeSession.openedAt,
      cutAt: closeDate,
      cashierName: activeSession.user.name,
      openingBalance: activeSession.openingBalance,
      cashSales: parseFloat(cashSales.toFixed(2)),
      cardSales: parseFloat(cardSales.toFixed(2)),
      appsSales: parseFloat(appsSales.toFixed(2)),
      giftCardSales: parseFloat(giftCardSales.toFixed(2)),
      transfersSales: parseFloat(transfersSales.toFixed(2)),
      totalSales,
      cashInTotal: parseFloat(cashInTotal.toFixed(2)),
      cashOutTotal: parseFloat(cashOutTotal.toFixed(2)),
      expectedCash,
      declaredCash,
      cashDifference,
      declaredCard: parsedDeclaredCard,
      declaredOther: parsedDeclaredOther,
      totalDeclared,
      totalDifference,
      ordersCount: completedOrders.length,
      discountsTotal: parseFloat(discountsTotal.toFixed(2)),
      canceledOrdersCount,
      canceledAmount: parseFloat(canceledAmount.toFixed(2)),
      tipsTotal,
      tipsCash: parseFloat(tipsCash.toFixed(2)),
      tipsCard: parseFloat(tipsCard.toFixed(2)),
      denominations: denominations || null,
      notes: notes || null,
    };

    const ticketText = generateCutTicketText(ticketData);

    await recordAuditLog({
      action: 'CASH_SESSION_CLOSED',
      entityType: 'CASH_SESSION',
      entityId: updatedSession.id,
      details: {
        cutNumber,
        consecutiveZ,
        expectedCash,
        declaredCash,
        cashDifference,
        ordersCount: completedOrders.length,
        totalSales,
        notes,
      },
      severity: Math.abs(cashDifference) > 0.5 ? 'CRITICAL' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      session: updatedSession,
      cut: cashCut,
      ticketData,
      ticketText,
    });
  } catch (error) {
    console.error('Error generating Corte Z:', error);
    return NextResponse.json({ error: 'Error al procesar el cierre oficial Corte Z' }, { status: 500 });
  }
}
