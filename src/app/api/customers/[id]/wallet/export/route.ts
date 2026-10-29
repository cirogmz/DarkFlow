import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const transactions = await prisma.customerWalletTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNumber: true, total: true } },
      },
    });

    const headers = [
      'Folio ID',
      'Fecha / Hora',
      'Tipo de Movimiento',
      'Monto ($ MXN)',
      'Saldo Anterior ($)',
      'Saldo Posterior ($)',
      'Referencia / Comanda',
      'Notas',
      'Registrado Por',
    ];

    const typeTranslations: Record<string, string> = {
      EARNED_CASHBACK: 'Cashback Ganado (Consumo)',
      REDEEMED_PAYMENT: 'Canje / Pago de Comanda',
      MANUAL_RECHARGE: 'Recarga Manual de Saldo',
      PROMO_BONUS: 'Bono Promocional de Lealtad',
      REFUND_ADJUSTMENT: 'Ajuste / Compensación',
    };

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = transactions.map((t) => [
      escapeCsv(t.id),
      escapeCsv(new Date(t.createdAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })),
      escapeCsv(typeTranslations[t.type] || t.type),
      t.amount.toFixed(2),
      t.balanceBefore.toFixed(2),
      t.balanceAfter.toFixed(2),
      escapeCsv(t.reference || (t.order ? `Comanda #${t.order.orderNumber}` : '')),
      escapeCsv(t.notes || ''),
      escapeCsv(t.createdByName || 'Sistema'),
    ]);

    const csvContent =
      '\uFEFF' +
      `"ESTADO DE CUENTA DE MONEDERO ELECTRÓNICO & CASHBACK"\n` +
      `"Cliente:","${customer.name}","Teléfono:","${customer.phone}","Nivel:","${customer.tier}"\n` +
      `"Saldo Actual:","$${customer.walletBalance.toFixed(2)} MXN","Cashback Total Ganado:","$${customer.totalCashbackEarned.toFixed(2)} MXN","Cashback Redimido:","$${customer.totalCashbackSpent.toFixed(2)} MXN"\n` +
      `"Generado:","${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}"\n\n` +
      headers.join(',') +
      '\n' +
      rows.map((row) => row.join(',')).join('\n');

    const cleanName = customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Estado_Cuenta_Monedero_${cleanName}_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting wallet transactions:', error);
    return NextResponse.json({ error: error.message || 'Error al exportar transacciones' }, { status: 500 });
  }
}

