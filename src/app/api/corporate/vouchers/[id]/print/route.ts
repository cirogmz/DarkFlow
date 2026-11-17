import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { generateVoucherThermalTicket } from '@/lib/corporateCredit';

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

    const voucher = await prisma.corporateCreditVoucher.findUnique({
      where: { id },
      include: {
        account: {
          include: { brand: true },
        },
        order: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json({ error: 'Vale de crédito no encontrado' }, { status: 404 });
    }

    const brandName = voucher.account.brand?.name || 'DarkFlow Gastronomía';
    const orderNumber = voucher.order?.orderNumber || 'SIN-ORDEN';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = voucher.order?.items.map((i: any) => ({
      name: i.product?.name || 'Consumo General',
      quantity: i.quantity,
      price: i.price,
      total: i.price * i.quantity,
    })) || [
      {
        name: 'Consumo Restaurante / Bar',
        quantity: 1,
        price: voucher.amount,
        total: voucher.amount,
      },
    ];

    const ticket = generateVoucherThermalTicket({
      brandName,
      orderNumber,
      voucher: {
        voucherFolio: voucher.voucherFolio,
        amount: voucher.amount,
        signedByName: voucher.signedByName,
        employeeId: voucher.employeeId,
        department: voucher.department,
        createdAt: voucher.createdAt,
        notes: voucher.notes,
      },
      account: {
        accountNumber: voucher.account.accountNumber,
        companyName: voucher.account.companyName,
        rfc: voucher.account.rfc,
        contactPhone: voucher.account.contactPhone,
        creditLimit: voucher.account.creditLimit,
        currentBalance: voucher.account.currentBalance,
      },
      items,
    });

    return NextResponse.json({
      ticket,
      voucher,
    });
  } catch (error) {
    console.error('Error generating voucher print ticket:', error);
    return NextResponse.json({ error: 'Error al generar ticket del pagaré' }, { status: 500 });
  }
}
