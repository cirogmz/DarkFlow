import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exportSettlementToCsv } from '@/lib/tipPool';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const settlement = await prisma.tipSettlement.findUnique({
      where: { id },
      include: {
        distributionDetails: {
          orderBy: { adjustedAmount: 'desc' },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const csvContent = exportSettlementToCsv(settlement);
    const filename = `liquidacion-propinas-${settlement.folio}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error al exportar liquidación a CSV:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

