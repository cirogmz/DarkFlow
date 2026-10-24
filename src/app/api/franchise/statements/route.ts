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
    const contractId = searchParams.get('contractId');
    const status = searchParams.get('status');
    const year = searchParams.get('year');

    const whereClause: any = { brandId: activeBrandId };
    if (contractId && contractId !== 'ALL') whereClause.contractId = contractId;
    if (status && status !== 'ALL') whereClause.status = status;
    if (year && year !== 'ALL') whereClause.periodYear = parseInt(year, 10);

    // RBAC: If franchisee or investor, restrict to their statements
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      whereClause.contract = {
        OR: [
          { partnerEmail: session.email },
          { userId: session.userId },
        ],
      };
    }

    const statements = await prisma.royaltyStatement.findMany({
      where: whereClause,
      include: {
        contract: {
          select: {
            contractFolio: true,
            partnerType: true,
            partnerName: true,
            royaltyFeePct: true,
            marketingFeePct: true,
            equitySharePct: true,
          },
        },
      },
      orderBy: { periodEnd: 'desc' },
    });

    return NextResponse.json({ statements });
  } catch (error: any) {
    console.error('Error fetching royalty statements:', error);
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

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden generar estados de cuenta' }, { status: 403 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      contractId,
      periodMonth,
      periodYear,
      periodStart,
      periodEnd,
      notes,
    } = body;

    if (!contractId || !periodMonth || !periodYear || !periodStart || !periodEnd) {
      return NextResponse.json({
        error: 'Contrato, mes, año, fecha de inicio y fecha de fin son requeridos',
      }, { status: 400 });
    }

    const contract = await prisma.franchiseContract.findFirst({
      where: { id: contractId, brandId: activeBrandId },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Query brand orders in this date range
    const orders = await prisma.order.findMany({
      where: {
        brandId: activeBrandId,
        createdAt: {
          gte: start,
          lte: end,
        },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        total: true,
        tax: true,
        subtotal: true,
        discountAmount: true,
      },
    });

    let grossSales = 0;
    let taxAmount = 0;
    let discountsAmount = 0;

    for (const o of orders) {
      grossSales += o.total;
      taxAmount += o.tax;
      discountsAmount += (o.discountAmount || 0);
    }

    grossSales = parseFloat(grossSales.toFixed(2));
    taxAmount = parseFloat(taxAmount.toFixed(2));
    discountsAmount = parseFloat(discountsAmount.toFixed(2));

    const netSales = contract.calculationBasis === 'GROSS_SALES'
      ? grossSales
      : parseFloat(Math.max(0, grossSales - taxAmount - discountsAmount).toFixed(2));

    const royaltyFeeAmount = parseFloat(((netSales * contract.royaltyFeePct) / 100).toFixed(2));
    const marketingFeeAmount = parseFloat(((netSales * contract.marketingFeePct) / 100).toFixed(2));
    const techFeeAmount = parseFloat(contract.techFeeMonthly.toFixed(2));
    const commissaryFeeAmount = parseFloat(((netSales * contract.commissaryFeePct) / 100).toFixed(2));

    const rawTotal = royaltyFeeAmount + marketingFeeAmount + techFeeAmount + commissaryFeeAmount;
    const totalDue = parseFloat(Math.max(contract.minimumMonthlyFee, rawTotal).toFixed(2));

    // Investor dividend calculation if partner is investor
    const investorShareAmount = contract.partnerType === 'INVESTOR'
      ? parseFloat(((netSales * contract.equitySharePct) / 100).toFixed(2))
      : 0;

    // Generate Statement Folio
    const monthPad = String(periodMonth).padStart(2, '0');
    const count = await prisma.royaltyStatement.count({ where: { brandId: activeBrandId } });
    const statementFolio = `ROY-${periodYear}-M${monthPad}-${count + 1}`;

    const statement = await prisma.royaltyStatement.create({
      data: {
        brandId: activeBrandId,
        contractId,
        statementFolio,
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        periodStart: start,
        periodEnd: end,
        ordersCount: orders.length,
        grossSales,
        taxAmount,
        discountsAmount,
        netSales,
        royaltyFeeAmount,
        marketingFeeAmount,
        techFeeAmount,
        commissaryFeeAmount,
        totalDue,
        investorShareAmount,
        status: 'ISSUED',
        issuedAt: new Date(),
        notes: notes ? String(notes).trim() : null,
        createdById: session.userId,
        createdByName: session.name,
      },
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'ROYALTY_STATEMENT_ISSUED',
      entityType: 'RoyaltyStatement',
      entityId: statement.id,
      severity: 'INFO',
      details: {
        statementFolio: statement.statementFolio,
        contractFolio: contract.contractFolio,
        partnerName: contract.partnerName,
        totalDue,
        ordersCount: orders.length,
      },
    });

    return NextResponse.json({
      statement,
      message: `Estado de cuenta ${statementFolio} generado exitosamente con ${orders.length} comandas auditadas`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error generating royalty statement:', error);
    return NextResponse.json({ error: error.message || 'Error al generar estado de cuenta' }, { status: 500 });
  }
}
