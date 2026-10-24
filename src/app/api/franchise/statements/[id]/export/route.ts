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

    const statement = await prisma.royaltyStatement.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        contract: true,
        brand: { select: { name: true, rfc: true, legalName: true } },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }

    // RBAC: Check ownership if partner role
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      const isOwner = statement.contract.userId === session.userId || statement.contract.partnerEmail === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'No tienes permiso para descargar este estado de cuenta' }, { status: 403 });
      }
    }

    // Fetch sample orders for this period
    const orders = await prisma.order.findMany({
      where: {
        brandId: activeBrandId,
        createdAt: {
          gte: statement.periodStart,
          lte: statement.periodEnd,
        },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        source: true,
        deliveryService: true,
        subtotal: true,
        tax: true,
        discountAmount: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Helper for CSV escaping
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    // Header info
    lines.push('DARKFLOW MANAGER - REPORTE EJECUTIVO DE REGALÍAS & REVENUE SHARE');
    lines.push(`Folio Estado de Cuenta,${escapeCsv(statement.statementFolio)}`);
    lines.push(`Marca,${escapeCsv(statement.brand.name)}`);
    lines.push(`Razón Social Marca,${escapeCsv(statement.brand.legalName || 'N/A')}`);
    lines.push(`RFC Marca,${escapeCsv(statement.brand.rfc || 'N/A')}`);
    lines.push(`Socio / Franquiciatario,${escapeCsv(statement.contract.partnerName)}`);
    lines.push(`Tipo de Contrato,${escapeCsv(statement.contract.partnerType)}`);
    lines.push(`Folio Contrato,${escapeCsv(statement.contract.contractFolio)}`);
    lines.push(`RFC Socio,${escapeCsv(statement.contract.partnerRfc || 'N/A')}`);
    lines.push(`Periodo Auditado,${escapeCsv(`${statement.periodYear}-M${String(statement.periodMonth).padStart(2, '0')}`)}`);
    lines.push(`Rango de Fechas,${escapeCsv(`${statement.periodStart.toISOString().split('T')[0]} al ${statement.periodEnd.toISOString().split('T')[0]}`)}`);
    lines.push(`Estado del Pago,${escapeCsv(statement.status)}`);
    if (statement.paidAt) {
      lines.push(`Fecha de Pago,${escapeCsv(statement.paidAt.toISOString())}`);
      lines.push(`Método de Pago,${escapeCsv(statement.paymentMethod || 'SPEI')}`);
      lines.push(`Referencia Bancaria,${escapeCsv(statement.paymentReference || 'N/A')}`);
    }
    lines.push('');

    // Summary calculation
    lines.push('DESGLOSE FINANCIERO LIQUIDABLE');
    lines.push('Concepto,Métrica Base,Porcentaje / Tarifa,Monto Liquidable (MXN)');
    lines.push(`Venta Bruta Total,,,$${statement.grossSales.toFixed(2)}`);
    lines.push(`Descuentos & Promociones,,,-$${statement.discountsAmount.toFixed(2)}`);
    lines.push(`Impuestos (IVA trasladado),,,-$${statement.taxAmount.toFixed(2)}`);
    lines.push(`Venta Neta Imputable,,,$${statement.netSales.toFixed(2)}`);
    lines.push(`Regalías de Marca (Royalties),Base: ${statement.contract.calculationBasis},${statement.contract.royaltyFeePct}%,$${statement.royaltyFeeAmount.toFixed(2)}`);
    lines.push(`Fondo Cooperativo de Marketing (Marketing Fee),Venta Neta,${statement.contract.marketingFeePct}%,$${statement.marketingFeeAmount.toFixed(2)}`);
    lines.push(`Cuota Tecnológica Mensual (Software & POS),Cuota Fija,,$${statement.techFeeAmount.toFixed(2)}`);
    if (statement.commissaryFeeAmount > 0) {
      lines.push(`Cuota Centro de Producción / Commissary,Venta Neta,${statement.contract.commissaryFeePct}%,$${statement.commissaryFeeAmount.toFixed(2)}`);
    }
    lines.push(`Cuota Mínima Mensual Garantizada,Piso Mínimo,,$${statement.contract.minimumMonthlyFee.toFixed(2)}`);
    lines.push(`TOTAL REGALÍAS & FEES POR PAGAR (FRANQUICIA),,,$${statement.totalDue.toFixed(2)}`);
    if (statement.contract.partnerType === 'INVESTOR') {
      lines.push(`Participación Utilidades / Dividendo Inversionista,Venta Neta,${statement.contract.equitySharePct}%,$${statement.investorShareAmount.toFixed(2)}`);
    }
    lines.push('');

    // Orders audit sample
    lines.push('AUDITORÍA DE COMANDAS MUESTRA (PRIMERAS 200)');
    lines.push('No. Comanda,Canal / Origen,Servicio Entrega,Fecha y Hora,Subtotal,IVA,Descuento,Total');
    for (const ord of orders) {
      lines.push([
        escapeCsv(ord.orderNumber || ord.id.slice(-6)),
        escapeCsv(ord.source || 'LOCAL'),
        escapeCsv(ord.deliveryService || 'LOCAL'),
        escapeCsv(ord.createdAt.toISOString().replace('T', ' ').slice(0, 19)),
        `$${ord.subtotal.toFixed(2)}`,
        `$${ord.tax.toFixed(2)}`,
        `$${(ord.discountAmount || 0).toFixed(2)}`,
        `$${ord.total.toFixed(2)}`,
      ].join(','));
    }

    const csvContent = '\uFEFF' + lines.join('\r\n'); // Add UTF-8 BOM for Excel compatibility

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Estado_Cuenta_${statement.statementFolio}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting statement to CSV:', error);
    return NextResponse.json({ error: error.message || 'Error al exportar estado de cuenta' }, { status: 500 });
  }
}
