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
    const partnerType = searchParams.get('partnerType');
    const status = searchParams.get('status');

    const whereClause: any = { brandId: activeBrandId };
    if (partnerType && partnerType !== 'ALL') whereClause.partnerType = partnerType;
    if (status && status !== 'ALL') whereClause.status = status;

    // RBAC: If franchisee or investor, restrict to their own contracts
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      whereClause.OR = [
        { partnerEmail: session.email },
        { userId: session.userId }
      ];
    }

    const contracts = await prisma.franchiseContract.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { statements: true },
        },
        statements: {
          take: 6,
          orderBy: { periodEnd: 'desc' },
          select: {
            id: true,
            statementFolio: true,
            periodMonth: true,
            periodYear: true,
            netSales: true,
            totalDue: true,
            investorShareAmount: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute portfolio metrics
    let totalActiveFranchisees = 0;
    let totalActiveInvestors = 0;
    let totalRoyaltiesCollected = 0;
    let totalInvestorDividendsPaid = 0;
    let pendingInvoicesTotal = 0;

    const allStatements = await prisma.royaltyStatement.findMany({
      where: { brandId: activeBrandId },
      select: {
        totalDue: true,
        investorShareAmount: true,
        status: true,
      },
    });

    for (const c of contracts) {
      if (c.status === 'ACTIVE') {
        if (c.partnerType === 'FRANCHISEE') totalActiveFranchisees++;
        if (c.partnerType === 'INVESTOR') totalActiveInvestors++;
      }
    }

    for (const s of allStatements) {
      if (s.status === 'PAID') {
        totalRoyaltiesCollected += s.totalDue;
        totalInvestorDividendsPaid += s.investorShareAmount;
      } else if (s.status === 'ISSUED' || s.status === 'DRAFT') {
        pendingInvoicesTotal += s.totalDue;
      }
    }

    return NextResponse.json({
      contracts,
      metrics: {
        totalContracts: contracts.length,
        totalActiveFranchisees,
        totalActiveInvestors,
        totalRoyaltiesCollected: parseFloat(totalRoyaltiesCollected.toFixed(2)),
        totalInvestorDividendsPaid: parseFloat(totalInvestorDividendsPaid.toFixed(2)),
        pendingInvoicesTotal: parseFloat(pendingInvoicesTotal.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching franchise contracts:', error);
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
      return NextResponse.json({ error: 'Solo administradores pueden crear contratos de franquicia o inversión' }, { status: 403 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      partnerType = 'FRANCHISEE', // FRANCHISEE | INVESTOR | JOINT_VENTURE
      partnerName,
      partnerEmail,
      userId,
      partnerPhone,
      partnerRfc,
      bankName,
      bankAccount,
      royaltyFeePct = 5.0,
      marketingFeePct = 2.0,
      techFeeMonthly = 1500.0,
      commissaryFeePct = 0.0,
      calculationBasis = 'NET_SALES',
      equitySharePct = 0.0,
      minimumMonthlyFee = 0.0,
      startDate,
      endDate,
      notes,
    } = body;

    if (!partnerName || !startDate) {
      return NextResponse.json({ error: 'Nombre del socio/franquiciatario y fecha de inicio son requeridos' }, { status: 400 });
    }

    // Auto-generate folio
    const prefix = partnerType === 'INVESTOR' ? 'INV' : 'FRAN';
    const count = await prisma.franchiseContract.count({ where: { brandId: activeBrandId } });
    const contractFolio = `${prefix}-${Date.now().toString().slice(-4)}-${count + 1}`;

    // Auto-link to user if matching email exists and no userId provided
    let linkedUserId = userId || null;
    if (!linkedUserId && partnerEmail) {
      const matchedUser = await prisma.user.findUnique({ where: { email: partnerEmail.trim().toLowerCase() } });
      if (matchedUser) linkedUserId = matchedUser.id;
    }

    const contract = await prisma.franchiseContract.create({
      data: {
        brandId: activeBrandId,
        userId: linkedUserId,
        contractFolio,
        partnerType,
        partnerName: partnerName.trim(),
        partnerEmail: partnerEmail ? partnerEmail.trim() : null,
        partnerPhone: partnerPhone ? partnerPhone.trim() : null,
        partnerRfc: partnerRfc ? partnerRfc.trim().toUpperCase() : null,
        bankName: bankName ? bankName.trim() : null,
        bankAccount: bankAccount ? bankAccount.trim() : null,
        royaltyFeePct: parseFloat(Number(royaltyFeePct).toFixed(2)),
        marketingFeePct: parseFloat(Number(marketingFeePct).toFixed(2)),
        techFeeMonthly: parseFloat(Number(techFeeMonthly).toFixed(2)),
        commissaryFeePct: parseFloat(Number(commissaryFeePct).toFixed(2)),
        calculationBasis,
        equitySharePct: parseFloat(Number(equitySharePct).toFixed(2)),
        minimumMonthlyFee: parseFloat(Number(minimumMonthlyFee).toFixed(2)),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: 'ACTIVE',
        notes: notes ? String(notes).trim() : null,
      },
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'FRANCHISE_CONTRACT_CREATED',
      entityType: 'FranchiseContract',
      entityId: contract.id,
      severity: 'INFO',
      details: {
        contractFolio: contract.contractFolio,
        partnerName: contract.partnerName,
        partnerType: contract.partnerType,
        royaltyFeePct: contract.royaltyFeePct,
      },
    });

    return NextResponse.json({
      contract,
      message: `Contrato ${contract.contractFolio} registrado exitosamente`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating franchise contract:', error);
    return NextResponse.json({ error: error.message || 'Error interno al registrar contrato' }, { status: 500 });
  }
}
