import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';

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

    const account = await prisma.corporateCreditAccount.findUnique({
      where: { id },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        customer: true,
        vouchers: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        statements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta corporativa no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Error fetching account details:', error);
    return NextResponse.json({ error: 'Error al consultar cuenta corporativa' }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await req.json();

    const existing = await prisma.corporateCreditAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Cuenta corporativa no encontrada' }, { status: 404 });
    }

    const {
      companyName,
      tradeName,
      rfc,
      taxRegime,
      cfdiUse,
      billingAddress,
      billingEmail,
      contactName,
      contactPhone,
      creditLimit,
      paymentTermsDays,
      status,
      authorizedRepin,
      notes,
    } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (companyName !== undefined) updateData.companyName = companyName.trim();
    if (tradeName !== undefined) updateData.tradeName = tradeName ? tradeName.trim() : null;
    if (rfc !== undefined) updateData.rfc = rfc ? rfc.trim().toUpperCase() : null;
    if (taxRegime !== undefined) updateData.taxRegime = taxRegime ? taxRegime.trim() : null;
    if (cfdiUse !== undefined) updateData.cfdiUse = cfdiUse;
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress ? billingAddress.trim() : null;
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail ? billingEmail.trim().toLowerCase() : null;
    if (contactName !== undefined) updateData.contactName = contactName.trim();
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone.trim();
    if (paymentTermsDays !== undefined) updateData.paymentTermsDays = Math.max(1, parseInt(String(paymentTermsDays), 10));
    if (status !== undefined) updateData.status = status;
    if (authorizedRepin !== undefined) updateData.authorizedRepin = authorizedRepin ? authorizedRepin.trim() : null;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

    if (creditLimit !== undefined) {
      const newLimit = Math.max(0, parseFloat(String(creditLimit)) || 0);
      updateData.creditLimit = newLimit;
      updateData.availableCredit = Math.max(0, Math.round((newLimit - existing.currentBalance) * 100) / 100);

      // Si el saldo supera el nuevo límite y está ACTIVE, marcar OVER_LIMIT
      if (existing.currentBalance > newLimit && (!status || status === 'ACTIVE')) {
        updateData.status = 'OVER_LIMIT';
      } else if (existing.currentBalance <= newLimit && existing.status === 'OVER_LIMIT' && !status) {
        updateData.status = 'ACTIVE';
      }
    }

    const updated = await prisma.corporateCreditAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      account: updated,
      message: 'Cuenta corporativa actualizada correctamente',
    });
  } catch (error) {
    console.error('Error updating corporate account:', error);
    return NextResponse.json({ error: 'Error al actualizar cuenta corporativa' }, { status: 500 });
  }
}

export async function DELETE(
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
    const account = await prisma.corporateCreditAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vouchers: true, orders: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    if (account.currentBalance > 0) {
      return NextResponse.json({
        error: `No se puede eliminar la cuenta porque tiene un saldo deudor pendiente de $${account.currentBalance.toFixed(2)} MXN`,
      }, { status: 400 });
    }

    // Si tiene vales históricos, cerrar en lugar de borrar
    if (account._count.vouchers > 0 || account._count.orders > 0) {
      const closed = await prisma.corporateCreditAccount.update({
        where: { id },
        data: { status: 'CLOSED' },
      });
      return NextResponse.json({
        message: 'La cuenta corporativa tiene registros históricos y fue cerrada definitivamente.',
        account: closed,
      });
    }

    await prisma.corporateCreditAccount.delete({ where: { id } });
    return NextResponse.json({ message: 'Cuenta corporativa eliminada con éxito' });
  } catch (error) {
    console.error('Error deleting corporate account:', error);
    return NextResponse.json({ error: 'Error al eliminar cuenta corporativa' }, { status: 500 });
  }
}
