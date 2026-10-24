import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year') || String(new Date().getFullYear());
    const selectedYear = parseInt(yearParam, 10);
    const partnerType = searchParams.get('partnerType');
    const contractId = searchParams.get('contractId');

    const contractWhere: any = { brandId: activeBrandId };
    if (partnerType && partnerType !== 'ALL') contractWhere.partnerType = partnerType;
    if (contractId && contractId !== 'ALL') contractWhere.id = contractId;

    // RBAC: If franchisee or investor, restrict to their own contract
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      contractWhere.OR = [
        { partnerEmail: session.email },
        { userId: session.userId },
      ];
    }

    const contracts = await prisma.franchiseContract.findMany({
      where: contractWhere,
      include: {
        statements: {
          where: { periodYear: selectedYear },
          orderBy: { periodMonth: 'asc' },
        },
      },
    });

    const contractIds = contracts.map((c) => c.id);

    // Fetch all statements for these contracts in the target year
    const statements = await prisma.royaltyStatement.findMany({
      where: {
        contractId: { in: contractIds },
        periodYear: selectedYear,
      },
      include: {
        contract: {
          select: {
            contractFolio: true,
            partnerName: true,
            partnerType: true,
            royaltyFeePct: true,
            equitySharePct: true,
          },
        },
      },
      orderBy: { periodMonth: 'asc' },
    });

    // Compute aggregated metrics
    let totalGrossSales = 0;
    let totalNetSales = 0;
    let totalDiscounts = 0;
    let totalTaxes = 0;
    let totalRoyaltyFee = 0;
    let totalMarketingFee = 0;
    let totalTechFee = 0;
    let totalCommissaryFee = 0;
    let totalInvestorDividends = 0;
    let totalDue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalOrdersCount = 0;

    for (const s of statements) {
      totalGrossSales += s.grossSales;
      totalNetSales += s.netSales;
      totalDiscounts += s.discountsAmount;
      totalTaxes += s.taxAmount;
      totalRoyaltyFee += s.royaltyFeeAmount;
      totalMarketingFee += s.marketingFeeAmount;
      totalTechFee += s.techFeeAmount;
      totalCommissaryFee += s.commissaryFeeAmount;
      totalInvestorDividends += s.investorShareAmount;
      totalDue += s.totalDue;
      totalOrdersCount += s.ordersCount;

      if (s.status === 'PAID') {
        totalPaid += s.totalDue;
      } else if (s.status === 'ISSUED' || s.status === 'DRAFT' || s.status === 'DISPUTED') {
        totalOutstanding += s.totalDue;
      }
    }

    // Monthly Evolution (Jan - Dec)
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];

    const monthlyEvolution = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthStatements = statements.filter((s) => s.periodMonth === monthNum);

      const gross = monthStatements.reduce((acc, s) => acc + s.grossSales, 0);
      const net = monthStatements.reduce((acc, s) => acc + s.netSales, 0);
      const royalties = monthStatements.reduce((acc, s) => acc + s.royaltyFeeAmount, 0);
      const marketing = monthStatements.reduce((acc, s) => acc + s.marketingFeeAmount, 0);
      const tech = monthStatements.reduce((acc, s) => acc + s.techFeeAmount, 0);
      const investorDividends = monthStatements.reduce((acc, s) => acc + s.investorShareAmount, 0);
      const orders = monthStatements.reduce((acc, s) => acc + s.ordersCount, 0);
      const due = monthStatements.reduce((acc, s) => acc + s.totalDue, 0);

      return {
        month: monthNum,
        monthName: monthNames[i],
        grossSales: parseFloat(gross.toFixed(2)),
        netSales: parseFloat(net.toFixed(2)),
        royalties: parseFloat(royalties.toFixed(2)),
        marketing: parseFloat(marketing.toFixed(2)),
        tech: parseFloat(tech.toFixed(2)),
        investorDividends: parseFloat(investorDividends.toFixed(2)),
        ordersCount: orders,
        totalDue: parseFloat(due.toFixed(2)),
      };
    });

    // Partner Breakdown
    const partnerBreakdown = contracts.map((c) => {
      const pStatements = statements.filter((s) => s.contractId === c.id);
      const pGross = pStatements.reduce((acc, s) => acc + s.grossSales, 0);
      const pNet = pStatements.reduce((acc, s) => acc + s.netSales, 0);
      const pDue = pStatements.reduce((acc, s) => acc + s.totalDue, 0);
      const pDividends = pStatements.reduce((acc, s) => acc + s.investorShareAmount, 0);
      const pOrders = pStatements.reduce((acc, s) => acc + s.ordersCount, 0);
      const pPaid = pStatements.filter((s) => s.status === 'PAID').reduce((acc, s) => acc + s.totalDue, 0);

      return {
        contractId: c.id,
        contractFolio: c.contractFolio,
        partnerName: c.partnerName,
        partnerType: c.partnerType,
        royaltyFeePct: c.royaltyFeePct,
        equitySharePct: c.equitySharePct,
        status: c.status,
        statementsCount: pStatements.length,
        ordersCount: pOrders,
        grossSales: parseFloat(pGross.toFixed(2)),
        netSales: parseFloat(pNet.toFixed(2)),
        totalDue: parseFloat(pDue.toFixed(2)),
        totalDividends: parseFloat(pDividends.toFixed(2)),
        totalPaid: parseFloat(pPaid.toFixed(2)),
        balanceDue: parseFloat((pDue - pPaid).toFixed(2)),
      };
    });

    // Brand target food cost for executive P&L
    const activeBrand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
      select: { name: true, slug: true, targetFoodCostPct: true, targetLaborCostPct: true },
    });

    const foodCostPct = activeBrand?.targetFoodCostPct || 30.0;
    const estimatedCogs = parseFloat(((totalNetSales * foodCostPct) / 100).toFixed(2));
    const estimatedGrossProfit = parseFloat((totalNetSales - estimatedCogs).toFixed(2));

    const pAndLSummary = {
      brandName: activeBrand?.name || 'Marca Activa',
      grossRevenue: parseFloat(totalGrossSales.toFixed(2)),
      discounts: parseFloat(totalDiscounts.toFixed(2)),
      taxes: parseFloat(totalTaxes.toFixed(2)),
      netRevenue: parseFloat(totalNetSales.toFixed(2)),
      estimatedCogs,
      foodCostPct,
      estimatedGrossProfit,
      royaltiesCollected: parseFloat(totalRoyaltyFee.toFixed(2)),
      marketingFund: parseFloat(totalMarketingFee.toFixed(2)),
      techFees: parseFloat(totalTechFee.toFixed(2)),
      commissaryFees: parseFloat(totalCommissaryFee.toFixed(2)),
      investorDividendsDistributed: parseFloat(totalInvestorDividends.toFixed(2)),
      retainedOperatingProfit: parseFloat((totalRoyaltyFee + totalTechFee + totalCommissaryFee).toFixed(2)),
    };

    return NextResponse.json({
      selectedYear,
      metrics: {
        totalGrossSales: parseFloat(totalGrossSales.toFixed(2)),
        totalNetSales: parseFloat(totalNetSales.toFixed(2)),
        totalRoyaltyFee: parseFloat(totalRoyaltyFee.toFixed(2)),
        totalMarketingFee: parseFloat(totalMarketingFee.toFixed(2)),
        totalTechFee: parseFloat(totalTechFee.toFixed(2)),
        totalCommissaryFee: parseFloat(totalCommissaryFee.toFixed(2)),
        totalInvestorDividends: parseFloat(totalInvestorDividends.toFixed(2)),
        totalDue: parseFloat(totalDue.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        totalOrdersCount,
      },
      monthlyEvolution,
      partnerBreakdown,
      pAndLSummary,
    });
  } catch (error: any) {
    console.error('Error generating franchise reports:', error);
    return NextResponse.json({ error: error.message || 'Error al generar reportes de franquicia' }, { status: 500 });
  }
}
