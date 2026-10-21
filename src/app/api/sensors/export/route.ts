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
    const sensorId = searchParams.get('sensorId');

    const readings = await prisma.sensorReading.findMany({
      where: {
        sensor: {
          brandId: activeBrandId,
          ...(sensorId ? { id: sensorId } : {}),
        },
      },
      include: {
        sensor: {
          include: { warehouse: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 1000,
    });

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'ID Lectura',
      'Fecha y Hora',
      'Sensor',
      'Código Dispositivo',
      'Tipo de Equipo',
      'Almacén / Bodega',
      'Temperatura (°C)',
      'Límite Mínimo (°C)',
      'Límite Máximo (°C)',
      'Humedad Relativa (%)',
      'Estatus HACCP',
      'Nivel Batería (%)',
    ];

    const rows = readings.map((r) => [
      escapeCsv(r.id),
      escapeCsv(new Date(r.recordedAt).toLocaleString('es-MX')),
      escapeCsv(r.sensor.name),
      escapeCsv(r.sensor.deviceCode),
      escapeCsv(r.sensor.sensorType),
      escapeCsv(r.sensor.warehouse?.name || 'Almacén General'),
      r.temperature.toFixed(1),
      r.sensor.targetTempMin.toFixed(1),
      r.sensor.targetTempMax.toFixed(1),
      r.humidity !== null && r.humidity !== undefined ? `${r.humidity.toFixed(0)}%` : 'N/A',
      escapeCsv(r.status === 'NORMAL' ? 'EN NORMA' : r.status === 'WARNING' ? 'DESVIACIÓN' : 'CRÍTICO / RUPTURA'),
      r.battery !== null && r.battery !== undefined ? `${r.battery}%` : 'N/A',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="DarkFlow_Bitacora_HACCP_Temperatura_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting HACCP temperature log:', error);
    return NextResponse.json(
      { error: 'Error al exportar bitácora HACCP', details: error.message },
      { status: 500 }
    );
  }
}
