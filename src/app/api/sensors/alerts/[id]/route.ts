import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function PATCH(
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
    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const { status, resolutionNotes } = body;

    const alert = await prisma.temperatureAlert.findFirst({
      where: {
        id,
        brandId: activeBrandId,
      },
      include: {
        sensor: true,
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
    }

    const now = new Date();
    const updateData: any = {};

    if (status === 'ACKNOWLEDGED') {
      updateData.status = 'ACKNOWLEDGED';
      updateData.acknowledgedAt = now;
      updateData.acknowledgedById = session.userId;
      updateData.acknowledgedByName = session.name || 'Supervisor de Cocina';
      if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    } else if (status === 'RESOLVED') {
      updateData.status = 'RESOLVED';
      updateData.resolvedAt = now;
      updateData.resolutionNotes = resolutionNotes || 'Alerta atendida y temperatura estabilizada.';

      // Check if sensor current temperature is back in range
      if (
        alert.sensor.currentTemp !== null &&
        alert.sensor.currentTemp <= alert.sensor.targetTempMax &&
        alert.sensor.currentTemp >= alert.sensor.targetTempMin
      ) {
        await prisma.temperatureSensor.update({
          where: { id: alert.sensorId },
          data: { status: 'NORMAL' },
        });
      }
    }

    const updatedAlert = await prisma.temperatureAlert.update({
      where: { id },
      data: updateData,
      include: {
        sensor: true,
      },
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: status === 'RESOLVED' ? 'COLD_CHAIN_ALERT_RESOLVED' : 'COLD_CHAIN_ALERT_ACKNOWLEDGED',
      entityType: 'WAREHOUSE',
      entityId: alert.sensorId,
      severity: 'INFO',
      details: {
        sensorName: alert.sensor.name,
        status,
        resolutionNotes,
        supervisor: session.name,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: status === 'RESOLVED' ? 'Alerta resuelta exitosamente' : 'Alerta reconocida por gerencia',
      alert: updatedAlert,
    });
  } catch (error: any) {
    console.error('Error updating temperature alert:', error);
    return NextResponse.json(
      { error: 'Error al actualizar alerta', details: error.message },
      { status: 500 }
    );
  }
}
