import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || (session.activeBrandId as string);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { tradeName: { contains: search } },
        { accountNumber: { contains: search } },
        { rfc: { contains: search } },
        { contactName: { contains: search } },
      ];
    }

    const accounts = await prisma.corporateCreditAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            vouchers: true,
            payments: true,
            statements: true,
            orders: true,
          },
        },
      },
    });

    // Calcular KPIs consolidados
    let totalAccounts = 0;
    let totalReceivables = 0;
    let totalCreditLimit = 0;
    let activeAccounts = 0;
    let overLimitAccounts = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accounts.forEach((acc: any) => {
      totalAccounts += 1;
      totalReceivables += acc.currentBalance;
      totalCreditLimit += acc.creditLimit;
      if (acc.status === 'ACTIVE') activeAccounts += 1;
      if (acc.status === 'OVER_LIMIT' || acc.currentBalance > acc.creditLimit) {
        overLimitAccounts += 1;
      }
    });

    const metrics = {
      totalAccounts,
      totalReceivables: Math.round(totalReceivables * 100) / 100,
      totalCreditLimit: Math.round(totalCreditLimit * 100) / 100,
      activeAccounts,
      overLimitAccounts,
      availableTotal: Math.max(0, Math.round((totalCreditLimit - totalReceivables) * 100) / 100),
    };

    return NextResponse.json({ accounts, metrics });
  } catch (error) {
    console.error('Error fetching corporate accounts:', error);
    return NextResponse.json({ error: 'Error al obtener cuentas corporativas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      brandId,
      customerId,
      companyName,
      tradeName,
      rfc,
      taxRegime,
      cfdiUse,
      billingAddress,
      billingEmail,
      contactName,
      contactPhone,
      creditLimit = 10000,
      paymentTermsDays = 15,
      authorizedRepin,
      notes,
    } = body;

    const activeBrandId = brandId || (session.activeBrandId as string);
    if (!activeBrandId || !companyName || !contactName || !contactPhone) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (brandId, companyName, contactName, contactPhone)' },
        { status: 400 }
      );
    }

    // Generar accountNumber correlativo por marca
    const count = await prisma.corporateCreditAccount.count({ where: { brandId: activeBrandId } });
    const accountNumber = `CORP-${(count + 1).toString().padStart(4, '0')}`;

    const limit = Math.max(0, parseFloat(String(creditLimit)) || 0);
    const terms = Math.max(1, parseInt(String(paymentTermsDays), 10) || 15);

    const newAccount = await prisma.corporateCreditAccount.create({
      data: {
        brandId: activeBrandId,
        customerId: customerId || null,
        accountNumber,
        companyName: companyName.trim(),
        tradeName: tradeName ? tradeName.trim() : null,
        rfc: rfc ? rfc.trim().toUpperCase() : null,
        taxRegime: taxRegime ? taxRegime.trim() : null,
        cfdiUse: cfdiUse || 'G03',
        billingAddress: billingAddress ? billingAddress.trim() : null,
        billingEmail: billingEmail ? billingEmail.trim().toLowerCase() : null,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        creditLimit: limit,
        currentBalance: 0,
        availableCredit: limit,
        paymentTermsDays: terms,
        status: 'ACTIVE',
        authorizedRepin: authorizedRepin ? authorizedRepin.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({
      account: newAccount,
      message: `Cuenta corporativa ${newAccount.accountNumber} creada con éxito`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating corporate account:', error);
    return NextResponse.json({ error: 'Error al registrar cuenta corporativa' }, { status: 500 });
  }
}
