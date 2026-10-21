import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);

    const timeframe = searchParams.get('timeframe') || '30d';
    const warehouseId = searchParams.get('warehouseId');
    const station = searchParams.get('station');
    const shift = searchParams.get('shift');
    const reason = searchParams.get('reason');
    const capaStatus = searchParams.get('capaStatus');

    let dateFilter: { gte?: Date } = {};
    const now = new Date();
    if (timeframe === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateFilter = { gte: d };
    } else if (timeframe === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFilter = { gte: d };
    } else if (timeframe === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      dateFilter = { gte: d };
    }

    const wasteLogs = await prisma.wasteLog.findMany({
      where: {
        brandId: activeBrandId,
        ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(station ? { station } : {}),
        ...(shift ? { shift } : {}),
        ...(reason ? { reason } : {}),
        ...(capaStatus ? { capaStatus } : {}),
      },
      include: {
        ingredient: true,
        warehouse: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute Pareto Classification
    const ingCostMap: Record<string, number> = {};
    let totalBrandWaste = 0;
    for (const w of wasteLogs) {
      ingCostMap[w.ingredientId] = (ingCostMap[w.ingredientId] || 0) + w.totalCost;
      totalBrandWaste += w.totalCost;
    }

    const sortedIngs = Object.entries(ingCostMap).sort((a, b) => b[1] - a[1]);
    let cumulative = 0;
    const paretoClassMap = new Map<string, string>();
    for (const [ingId, cost] of sortedIngs) {
      cumulative += cost;
      const cumPct = totalBrandWaste > 0 ? (cumulative / totalBrandWaste) * 100 : 0;
      if (cumPct <= 80 || (cumPct - (cost / totalBrandWaste) * 100 < 80)) {
        paretoClassMap.set(ingId, 'A (Vital Few 80%)');
      } else if (cumPct <= 95) {
        paretoClassMap.set(ingId, 'B (Medio 15%)');
      } else {
        paretoClassMap.set(ingId, 'C (Trivial 5%)');
      }
    }

    // Escape CSV values
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'ID Registro',
      'Fecha y Hora',
      'Insumo',
      'Clasificación Pareto',
      'Cantidad',
      'Unidad',
      'Costo Unitario ($)',
      'Costo Total Pérdida ($)',
      'Motivo Merma',
      'Estación de Cocina',
      'Turno Operativo',
      'Almacén / Bodega',
      'Responsable Registro',
      'Categoría Causa Raíz (RCA)',
      'Análisis 5-Porqués (RCA)',
      'Plan de Acción Correctiva (CAPA)',
      'Estatus CAPA',
      'Responsable CAPA',
      'Fecha Límite CAPA',
      'Fecha Resolución',
      'Resuelto Por',
      'Notas de Resolución',
      'Observaciones Adicionales',
    ];

    const rows = wasteLogs.map((log) => [
      escapeCsv(log.id),
      escapeCsv(new Date(log.createdAt).toLocaleString('es-MX')),
      escapeCsv(log.ingredient.name),
      escapeCsv(paretoClassMap.get(log.ingredientId) || 'C (Trivial 5%)'),
      log.quantity,
      escapeCsv(log.ingredient.unit),
      log.costPerUnit.toFixed(2),
      log.totalCost.toFixed(2),
      escapeCsv(log.reason),
      escapeCsv(log.station || 'KITCHEN_HOT'),
      escapeCsv(log.shift || 'MORNING'),
      escapeCsv(log.warehouse?.name || 'Almacén General'),
      escapeCsv(log.user?.name || 'Sistema'),
      escapeCsv(log.rcaCategory || 'N/A'),
      escapeCsv(log.rcaWhys || 'N/A'),
      escapeCsv(log.correctiveAction || 'N/A'),
      escapeCsv(log.capaStatus || 'NONE'),
      escapeCsv(log.capaAssignee || 'N/A'),
      escapeCsv(log.capaDueDate ? new Date(log.capaDueDate).toLocaleDateString('es-MX') : 'N/A'),
      escapeCsv(log.capaResolvedAt ? new Date(log.capaResolvedAt).toLocaleString('es-MX') : 'N/A'),
      escapeCsv(log.capaResolvedByName || 'N/A'),
      escapeCsv(log.capaResolutionNotes || 'N/A'),
      escapeCsv(log.notes || ''),
    ]);

    // Prepend UTF-8 BOM so Excel opens accents cleanly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="DarkFlow_Mermas_RCA_Pareto_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting waste logs to CSV:', error);
    return NextResponse.json(
      { error: 'Error al exportar mermas', details: error.message },
      { status: 500 }
    );
  }
}
