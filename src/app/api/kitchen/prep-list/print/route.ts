import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();
    const { prepListId, station = 'ALL', paperWidth = '80mm' } = body;

    if (!prepListId) {
      return NextResponse.json({ error: 'ID de lista de preparación requerido' }, { status: 400 });
    }

    const prepList = await prisma.dailyPrepList.findFirst({
      where: { id: prepListId, brandId: activeBrandId },
      include: {
        brand: true,
        createdBy: true,
        items: {
          orderBy: [{ station: 'asc' }, { suggestedPrepQty: 'desc' }],
        },
      },
    });

    if (!prepList) {
      return NextResponse.json({ error: 'Lista de preparación no encontrada' }, { status: 404 });
    }

    let items = prepList.items;
    if (station && station !== 'ALL') {
      items = items.filter((i) => i.station.toUpperCase() === station.toUpperCase());
    }

    const colWidth = paperWidth === '58mm' ? 32 : 48;
    const divider = '='.repeat(colWidth);
    const subDivider = '-'.repeat(colWidth);

    const dateStr = new Date(prepList.date).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const shiftMap: Record<string, string> = {
      ALL_DAY: 'TODO EL DIA (COMPLETO)',
      LUNCH: 'TURNO ALMUERZO / COMIDA (11:00 - 17:00)',
      DINNER: 'TURNO CENA (17:00 - CIERRE)',
    };

    const lines: string[] = [];
    lines.push(divider);
    lines.push(centerText(prepList.brand.name.toUpperCase(), colWidth));
    lines.push(centerText('GUIA DIARIA DE PRODUCCION (PREP LIST)', colWidth));
    lines.push(divider);
    lines.push(`Fecha: ${dateStr}`);
    lines.push(`Turno: ${shiftMap[prepList.shift] || prepList.shift}`);
    lines.push(`Estacion: ${station === 'ALL' ? 'TODAS LAS ESTACIONES' : station}`);
    lines.push(`Margen de Seguridad: +${prepList.bufferPct}%`);
    lines.push(`Folio: PREP-${prepList.id.substring(0, 8).toUpperCase()}`);
    lines.push(subDivider);
    lines.push(padColumns('[ ] ITEM / ESTACION', 'STOCK', 'PREP SUG.', colWidth));
    lines.push(subDivider);

    for (const item of items) {
      const checkbox = item.status === 'COMPLETED' ? '[X]' : '[ ]';
      const nameLine = `${checkbox} ${item.itemName.toUpperCase()} (${item.station})`;
      const stockStr = `${item.currentStock} ${item.unit}`;
      const prepStr = `${item.suggestedPrepQty} ${item.unit}`;

      lines.push(nameLine);
      lines.push(padColumns('    Demanda: ' + item.projectedDemand, 'Act: ' + stockStr, '=> ' + prepStr, colWidth));
      if (item.status === 'COMPLETED') {
        lines.push('    * COMPLETADO *');
      }
      lines.push('');
    }

    lines.push(divider);
    lines.push(`Total de Items: ${items.length}`);
    lines.push(`Generado: ${new Date().toLocaleTimeString('es-MX')}`);
    lines.push('');
    lines.push('Firma Cocinero: ________________________');
    lines.push('');
    lines.push('Firma Chef/Lider: ______________________');
    lines.push(divider);

    const textTicket = lines.join('\n');

    return NextResponse.json({
      success: true,
      textTicket,
      itemsCount: items.length,
    });
  } catch (error: unknown) {
    console.error('Error generating print prep ticket:', error);
    return NextResponse.json({ error: 'Error al generar ticket de impresión' }, { status: 500 });
  }
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  const left = Math.floor((width - text.length) / 2);
  return ' '.repeat(left) + text;
}

function padColumns(left: string, mid: string, right: string, width: number): string {
  const rightPad = right.padStart(10);
  const midPad = mid.padStart(12);
  const leftWidth = Math.max(1, width - rightPad.length - midPad.length);
  const leftTrunc = left.length > leftWidth ? left.substring(0, leftWidth) : left.padEnd(leftWidth);
  return `${leftTrunc}${midPad}${rightPad}`;
}
