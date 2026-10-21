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
    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const audit = await prisma.inventoryAudit.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
      include: {
        brand: true,
        warehouse: true,
        conductedBy: true,
        items: {
          include: {
            ingredient: true,
          },
          orderBy: { discrepancyCost: 'asc' },
        },
      },
    });

    if (!audit) {
      return NextResponse.json({ error: 'Auditoría no encontrada' }, { status: 404 });
    }

    // Format plain text receipt for 80mm / 48 column ESC/POS thermal printers
    const separator = '------------------------------------------------';
    const doubleSep = '================================================';

    const lines: string[] = [];
    lines.push(audit.brand.name.toUpperCase().padStart(24 + Math.floor(audit.brand.name.length / 2)));
    lines.push('COMPROBANTE DE ARQUEO FÍSICO DE INVENTARIO'.padStart(44));
    lines.push(doubleSep);
    lines.push(`Folio Auditoría:   ${audit.auditNumber}`);
    if (audit.adjustmentFolio) {
      lines.push(`Folio Ajuste:      ${audit.adjustmentFolio}`);
    }
    lines.push(`Tipo de Arqueo:    ${audit.type === 'BLIND' ? 'ARQUEO CIEGO' : 'COMPLETO'}`);
    lines.push(`Estado:            ${audit.status === 'APPLIED' ? 'APLICADO A STOCK' : 'PENDIENTE'}`);
    lines.push(`Almacén:           ${audit.warehouse ? audit.warehouse.name : 'Almacén General'}`);
    lines.push(`Auditor:           ${audit.conductedBy?.name || 'Sistema'}`);
    if (audit.approvedByName) {
      lines.push(`Aprobado Por:      ${audit.approvedByName}`);
    }
    lines.push(`Fecha:             ${new Date(audit.createdAt).toLocaleString('es-MX')}`);
    lines.push(separator);
    lines.push('INSUMO           ESPERADO    CONTEO       DIF($)');
    lines.push(separator);

    for (const item of audit.items) {
      const name = item.ingredient.name.slice(0, 15).padEnd(15);
      const exp = `${item.expectedStock}`.padStart(9);
      const cnt = `${item.countedStock}`.padStart(9);
      const diffSign = item.discrepancyCost > 0 ? `+$${item.discrepancyCost.toFixed(1)}` : `$${item.discrepancyCost.toFixed(1)}`;
      const diff = diffSign.padStart(11);
      lines.push(`${name} ${exp} ${cnt} ${diff}`);
    }

    lines.push(doubleSep);
    lines.push(`Valor Teórico Esperado:       $${audit.totalExpectedValue.toFixed(2).padStart(12)}`);
    lines.push(`Valor Físico Real Contado:    $${audit.totalCountedValue.toFixed(2).padStart(12)}`);
    lines.push(`Varianza Neta Total:          $${audit.totalDiscrepancyValue.toFixed(2).padStart(12)}`);
    if (audit.variancePct !== null && audit.variancePct !== undefined) {
      lines.push(`Varianza Porcentual:          ${`${audit.variancePct > 0 ? '+' : ''}${audit.variancePct.toFixed(2)}%`.padStart(13)}`);
    }
    lines.push(separator);
    lines.push('');
    lines.push('');
    lines.push('   _____________________      _____________________   ');
    lines.push('     Firma del Auditor          Firma de Gerencia     ');
    lines.push('');
    lines.push('Documento oficial inmutable emitido por DarkFlow ERP.');

    const ticketText = lines.join('\n');

    return NextResponse.json({
      success: true,
      auditNumber: audit.auditNumber,
      adjustmentFolio: audit.adjustmentFolio,
      ticketText,
    });
  } catch (error: any) {
    console.error('Error generating audit thermal print text:', error);
    return NextResponse.json(
      { error: 'Error al generar impresión de auditoría', details: error.message },
      { status: 500 }
    );
  }
}
