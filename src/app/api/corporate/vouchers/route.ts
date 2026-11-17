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
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (accountId) {
      where.accountId = accountId;
    } else if (brandId) {
      where.account = { brandId };
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const vouchers = await prisma.corporateCreditVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            companyName: true,
            rfc: true,
            creditLimit: true,
            currentBalance: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        statement: {
          select: {
            id: true,
            statementFolio: true,
            periodEnd: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error('Error fetching corporate vouchers:', error);
    return NextResponse.json({ error: 'Error al obtener vales de crédito corporativo' }, { status: 500 });
  }
}
