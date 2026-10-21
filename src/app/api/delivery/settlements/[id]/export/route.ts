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

    const activeBrandId = session.activeBrandId as string;

    const settlement = await prisma.deliveryPayoutSettlement.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        brand: { select: { name: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
        },
        disputes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const lines: string[] = [];

    // Header block
    lines.push(`"DARKFLOW MANAGER - REPORTE OFICIAL DE CONCILIACIÓN Y LIQUIDACIÓN DELIVERY"`);
    lines.push(`"Marca:","${settlement.brand.name}"`);
    lines.push(`"Folio Liquidación:","${settlement.folio}"`);
    lines.push(`"Plataforma:","${settlement.platform}"`);
    lines.push(`"Estado:","${settlement.status}"`);
    lines.push(`"Período:","${settlement.periodStart.toISOString().slice(0, 10)} al ${settlement.periodEnd.toISOString().slice(0, 10)}"`);
    lines.push(`"Fecha Depósito Bancario:","${settlement.bankDepositDate ? settlement.bankDepositDate.toISOString().slice(0, 10) : 'N/A'}"`);
    lines.push(`"Referencia Bancaria:","${settlement.bankReference || 'N/A'}"`);
    lines.push(`"Conciliado por:","${settlement.reconciledByName || 'Sistema'}"`);
    lines.push(`"Fecha Conciliación:","${settlement.reconciledAt ? settlement.reconciledAt.toISOString().replace('T', ' ').slice(0, 19) : 'N/A'}"`);
    lines.push('');

    // Summary block
    lines.push(`"DESGLOSE CONTABLE Y FINANCIERO (MXN)"`);
    lines.push(`"Concepto","Monto ($ MXN)"`);
    lines.push(`"(+) Ventas Brutas Totales (${settlement.ordersCount} comandas)","${settlement.grossSales.toFixed(2)}"`);
    lines.push(`"(-) Comisión Base de Plataforma","-${settlement.platformCommission.toFixed(2)}"`);
    lines.push(`"(-) IVA de Comisión (16%)","-${settlement.commissionTax.toFixed(2)}"`);
    lines.push(`"(-) Retención Fiscal ISR Plataformas Digitales","-${settlement.withholdingIsr.toFixed(2)}"`);
    lines.push(`"(-) Retención Fiscal IVA Plataformas Digitales","-${settlement.withholdingIva.toFixed(2)}"`);
    lines.push(`"(-) Promociones y Cupones Absorbidos","-${settlement.promotionsFunded.toFixed(2)}"`);
    lines.push(`"(-) Ajustes y Reembolsos a Clientes","-${settlement.adjustmentsRefunds.toFixed(2)}"`);
    lines.push(`"(=) PAGO NETO TEÓRICO CALCULADO","${settlement.netPayoutCalculated.toFixed(2)}"`);
    lines.push(`"(=) DEPÓSITO BANCARIO REAL RECIBIDO","${settlement.bankDepositAmount.toFixed(2)}"`);
    lines.push(`"(=) VARIANZA / DISCREPANCIA NETA","${settlement.variance.toFixed(2)}"`);
    lines.push('');

    // Detailed Orders Block
    lines.push(`"DETALLE DE COMANDAS RECONCILIADAS"`);
    lines.push(`"Folio DF","ID Externo App","Fecha y Hora","Cliente","Teléfono","Subtotal ($)","Impuestos ($)","Venta Total ($)","Comisión Tasa %","Comisión ($)","Pago Neto ($)","Estado Conciliación"`);

    for (const o of settlement.orders) {
      const commRate = o.platformCommissionRate || 0;
      const commAmount = o.platformCommission || 0;
      const net = o.netPayout || (o.total - commAmount);
      const safeCustomer = (o.customerName || '').replace(/"/g, '""');
      const safeDate = o.createdAt.toISOString().replace('T', ' ').slice(0, 19);

      lines.push(
        `"${o.orderNumber}","${o.externalOrderId || ''}","${safeDate}","${safeCustomer}","${o.customerPhone || ''}","${o.subtotal.toFixed(2)}","${o.tax.toFixed(2)}","${o.total.toFixed(2)}","${commRate}%","${commAmount.toFixed(2)}","${net.toFixed(2)}","${o.reconciliationStatus}"`
      );
    }

    if (settlement.disputes.length > 0) {
      lines.push('');
      lines.push(`"DISPUTAS Y RECLAMOS ASOCIADOS"`);
      lines.push(`"Folio Disputa","Tipo de Reclamo","Monto Reclamado ($)","Monto Recuperado ($)","Estado","Motivo","Fecha"`);
      for (const d of settlement.disputes) {
        const safeReason = (d.reason || '').replace(/"/g, '""');
        const safeDate = d.createdAt.toISOString().replace('T', ' ').slice(0, 19);
        lines.push(
          `"${d.ticketFolio || d.id}","${d.disputeType}","${d.claimedAmount.toFixed(2)}","${d.recoveredAmount.toFixed(2)}","${d.status}","${safeReason}","${safeDate}"`
        );
      }
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const filename = `Liquidacion_${settlement.platform}_${settlement.folio}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting delivery settlement CSV:', error);
    return NextResponse.json({ error: error.message || 'Error al exportar liquidación' }, { status: 500 });
  }
}
