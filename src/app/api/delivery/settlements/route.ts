import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);
    const platformFilter = searchParams.get('platform');
    const statusFilter = searchParams.get('status');

    const whereClause: any = { brandId: activeBrandId };
    if (platformFilter && platformFilter !== 'ALL') {
      whereClause.platform = platformFilter;
    }
    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }

    const settlements = await prisma.deliveryPayoutSettlement.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            orders: true,
            disputes: true,
          },
        },
        disputes: {
          select: {
            id: true,
            disputeType: true,
            claimedAmount: true,
            recoveredAmount: true,
            status: true,
          },
        },
      },
      orderBy: { periodEnd: 'desc' },
    });

    // Compute global metrics
    let totalSettledGrossSales = 0;
    let totalPlatformCommissions = 0;
    let totalTaxesWithheld = 0;
    let totalBankReceived = 0;
    let totalVariance = 0;

    for (const s of settlements) {
      totalSettledGrossSales += s.grossSales;
      totalPlatformCommissions += (s.platformCommission + s.commissionTax);
      totalTaxesWithheld += (s.withholdingIsr + s.withholdingIva);
      totalBankReceived += s.bankDepositAmount;
      totalVariance += s.variance;
    }

    // Get unreconciled delivery orders count and gross total
    const unreconciledOrders = await prisma.order.findMany({
      where: {
        brandId: activeBrandId,
        source: { in: ['UBER_EATS', 'RAPPI', 'DIDI_FOOD'] },
        reconciliationStatus: 'UNRECONCILED',
      },
      select: {
        id: true,
        total: true,
        source: true,
        platformCommission: true,
      },
    });

    const unreconciledGrossSales = unreconciledOrders.reduce((acc, o) => acc + o.total, 0);
    const unreconciledByPlatform: Record<string, { count: number; total: number }> = {
      UBER_EATS: { count: 0, total: 0 },
      RAPPI: { count: 0, total: 0 },
      DIDI_FOOD: { count: 0, total: 0 },
    };

    for (const o of unreconciledOrders) {
      if (unreconciledByPlatform[o.source]) {
        unreconciledByPlatform[o.source].count += 1;
        unreconciledByPlatform[o.source].total += o.total;
      }
    }

    // Open disputes count
    const openDisputesCount = await prisma.deliveryDispute.count({
      where: {
        brandId: activeBrandId,
        status: { in: ['OPEN', 'SUBMITTED_TO_APP'] },
      },
    });

    return NextResponse.json({
      settlements,
      metrics: {
        totalSettledGrossSales: parseFloat(totalSettledGrossSales.toFixed(2)),
        totalPlatformCommissions: parseFloat(totalPlatformCommissions.toFixed(2)),
        totalTaxesWithheld: parseFloat(totalTaxesWithheld.toFixed(2)),
        totalBankReceived: parseFloat(totalBankReceived.toFixed(2)),
        totalVariance: parseFloat(totalVariance.toFixed(2)),
        settlementsCount: settlements.length,
        openDisputesCount,
        unreconciledCount: unreconciledOrders.length,
        unreconciledGrossSales: parseFloat(unreconciledGrossSales.toFixed(2)),
        unreconciledByPlatform,
      },
    });
  } catch (error: any) {
    console.error('Error fetching delivery settlements:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
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
      platform, // UBER_EATS | RAPPI | DIDI_FOOD
      periodStart,
      periodEnd,
      bankDepositAmount = 0,
      bankReference,
      bankDepositDate,
      promotionsFunded = 0,
      adjustmentsRefunds = 0,
      customCommissionRate,
      withholdingIsrRate = 1.0, // Standard digital platform ISR in Mexico
      withholdingIvaRate = 8.0, // Standard digital platform 50% VAT retention
      notes,
      orderIds, // Optional explicit list of order IDs
    } = body;

    if (!platform || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Plataforma, fecha inicio y fecha fin son requeridos' }, { status: 400 });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Find orders to reconcile
    let ordersToReconcile: any[] = [];
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      ordersToReconcile = await prisma.order.findMany({
        where: {
          id: { in: orderIds },
          brandId: activeBrandId,
          source: platform,
        },
      });
    } else {
      ordersToReconcile = await prisma.order.findMany({
        where: {
          brandId: activeBrandId,
          source: platform,
          createdAt: {
            gte: start,
            lte: end,
          },
          reconciliationStatus: 'UNRECONCILED',
        },
      });
    }

    if (ordersToReconcile.length === 0) {
      return NextResponse.json({
        error: `No se encontraron comandas no conciliadas de ${platform} entre ${start.toISOString().slice(0, 10)} y ${end.toISOString().slice(0, 10)}`,
      }, { status: 400 });
    }

    // Calculate totals
    let grossSales = 0;
    let platformCommission = 0;

    for (const o of ordersToReconcile) {
      grossSales += o.total;
      const rate = customCommissionRate !== undefined 
        ? Number(customCommissionRate) 
        : (o.platformCommissionRate || (platform === 'UBER_EATS' ? 28 : platform === 'RAPPI' ? 25 : 22));
      
      const comm = o.platformCommission && o.platformCommission > 0
        ? o.platformCommission
        : parseFloat(((o.total * rate) / 100).toFixed(2));
      
      platformCommission += comm;
    }

    grossSales = parseFloat(grossSales.toFixed(2));
    platformCommission = parseFloat(platformCommission.toFixed(2));
    
    // Tax on commission: 16% VAT on the commission billed by app
    const commissionTax = parseFloat(((platformCommission * 0.16)).toFixed(2));
    
    // Tax withholdings on gross sales
    const withholdingIsr = parseFloat(((grossSales * (Number(withholdingIsrRate) / 100))).toFixed(2));
    const withholdingIva = parseFloat(((grossSales * (Number(withholdingIvaRate) / 100))).toFixed(2));
    
    const parsedPromos = parseFloat(Number(promotionsFunded || 0).toFixed(2));
    const parsedAdjustments = parseFloat(Number(adjustmentsRefunds || 0).toFixed(2));
    const parsedBankDeposit = parseFloat(Number(bankDepositAmount || 0).toFixed(2));

    const netPayoutCalculated = parseFloat((
      grossSales - platformCommission - commissionTax - withholdingIsr - withholdingIva - parsedPromos - parsedAdjustments
    ).toFixed(2));

    const variance = parseFloat((parsedBankDeposit - netPayoutCalculated).toFixed(2));
    
    // If difference is less than $1 MXN, consider perfectly reconciled
    const isMatched = Math.abs(variance) <= 1.0;
    const settlementStatus = isMatched ? 'RECONCILED' : 'DISCREPANCY';

    // Unique folio
    const folioCode = `SETTLE-${platform.replace('_', '')}-${Date.now().toString().slice(-6)}`;

    const result = await prisma.$transaction(async (tx) => {
      const settlement = await tx.deliveryPayoutSettlement.create({
        data: {
          brandId: activeBrandId,
          platform,
          folio: folioCode,
          periodStart: start,
          periodEnd: end,
          bankDepositDate: bankDepositDate ? new Date(bankDepositDate) : new Date(),
          bankReference: bankReference ? String(bankReference).trim() : null,
          status: settlementStatus,
          ordersCount: ordersToReconcile.length,
          grossSales,
          platformCommission,
          commissionTax,
          withholdingIsr,
          withholdingIva,
          promotionsFunded: parsedPromos,
          adjustmentsRefunds: parsedAdjustments,
          netPayoutCalculated,
          bankDepositAmount: parsedBankDeposit,
          variance,
          notes: notes ? String(notes).trim() : null,
          reconciledById: session.userId,
          reconciledByName: session.name,
          reconciledAt: new Date(),
        },
      });

      // Update reconciled orders
      const orderIdsToUpdate = ordersToReconcile.map((o) => o.id);
      await tx.order.updateMany({
        where: { id: { in: orderIdsToUpdate } },
        data: {
          payoutSettlementId: settlement.id,
          reconciliationStatus: isMatched ? 'RECONCILED' : 'DISPUTED',
        },
      });

      // If discrepancy with missing bank payout (negative variance), automatically create a dispute ticket
      if (variance < -1.0) {
        await tx.deliveryDispute.create({
          data: {
            brandId: activeBrandId,
            settlementId: settlement.id,
            platform,
            disputeType: 'UNPAID_ORDER',
            claimedAmount: Math.abs(variance),
            status: 'OPEN',
            ticketFolio: `DISP-${folioCode}`,
            reason: `Discrepancia en liquidación ${folioCode}: faltante de depósito bancario de $${Math.abs(variance).toFixed(2)} MXN respecto al cálculo teórico neto`,
            createdById: session.userId,
            createdByName: session.name,
          },
        });
      }

      return settlement;
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'DELIVERY_PAYOUT_SETTLEMENT_CREATED',
      entityType: 'DeliveryPayoutSettlement',
      entityId: result.id,
      severity: settlementStatus === 'RECONCILED' ? 'INFO' : 'WARNING',
      details: {
        folio: result.folio,
        platform,
        grossSales,
        netPayoutCalculated,
        bankDepositAmount: parsedBankDeposit,
        variance,
        ordersCount: ordersToReconcile.length,
      },
    });

    return NextResponse.json({
      settlement: result,
      message: isMatched 
        ? `Liquidación ${folioCode} conciliada exitosamente con 0 discrepancias` 
        : `Liquidación ${folioCode} registrada con varianza de $${variance.toFixed(2)} MXN`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delivery settlement:', error);
    return NextResponse.json({ error: error.message || 'Error interno al crear liquidación' }, { status: 500 });
  }
}
