import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateThermalTipReceipt } from '@/lib/tipPool';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');

    const settlement = await prisma.tipSettlement.findUnique({
      where: { id },
      include: {
        brand: true,
        distributionDetails: true,
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const brandName = settlement.brand?.name || 'DarkFlow';

    // 1. Si se solicita recibo de un colaborador específico
    if (itemId) {
      const item = settlement.distributionDetails.find((d) => d.id === itemId);
      if (!item) {
        return NextResponse.json({ error: 'Colaborador no encontrado en esta liquidación' }, { status: 404 });
      }

      const receipt = generateThermalTipReceipt({
        brandName,
        folio: settlement.folio,
        shift: settlement.shift,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
        item: {
          employeeName: item.employeeName,
          role: item.role,
          hoursWorked: item.hoursWorked,
          pointsWeight: item.pointsWeight,
          weightedPoints: item.weightedPoints,
          sharePercentage: item.sharePercentage,
          adjustedAmount: item.adjustedAmount,
          payoutMethod: item.payoutMethod,
        },
        totalPool: settlement.totalTips,
      });

      return new NextResponse(receipt, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // 2. Si no se especifica colaborador, generar Hoja General de Reparto del Turno
    const dateFmt = (d: Date) => d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    let summaryText = `
========================================
       ${brandName.toUpperCase()}
   HOJA RESUMEN DE REPARTO DE PROPINAS
========================================
FOLIO: ${settlement.folio}
TURNO: ${settlement.shift}
ESTATUS: ${settlement.status}
PERIODO: ${dateFmt(settlement.periodStart)}
      a  ${dateFmt(settlement.periodEnd)}
----------------------------------------
PROPINAS EFECTIVO:   $${settlement.cashTips.toFixed(2)} MXN
PROPINAS TARJETA:    $${settlement.cardTips.toFixed(2)} MXN
PROPINAS DIGITAL:    $${settlement.digitalTips.toFixed(2)} MXN
TOTAL BOLSA REPARTO: $${settlement.totalTips.toFixed(2)} MXN
HORAS TOTALES EQUIPO: ${settlement.totalHoursWorked.toFixed(1)} hrs
----------------------------------------
DESGLOSE POR COLABORADOR:
----------------------------------------
`;

    for (const d of settlement.distributionDetails) {
      summaryText += `${d.employeeName.slice(0, 18).padEnd(18)} | ${d.hoursWorked}h | $${d.adjustedAmount.toFixed(2)}\n`;
    }

    summaryText += `
----------------------------------------
Aprobado por: ${settlement.approvedByName || 'Pendiente'}
Fecha Aprobación: ${settlement.approvedAt ? dateFmt(settlement.approvedAt) : 'Pendiente'}

FIRMA GERENTE / SUPERVISOR EN TURNO:



________________________________________

Impreso: ${dateFmt(new Date())}
DarkFlow Tip Engine v1.59
========================================
`.trim();

    return new NextResponse(summaryText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error al generar impresión térmica:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

