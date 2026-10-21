import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    // Support both user sessions and IoT API key header
    const apiKey = req.headers.get('x-iot-api-key');
    let brandId = session?.activeBrandId;

    const body = await req.json();
    const { deviceCode, sensorId, temperature, humidity, battery } = body;

    if (temperature === undefined || (!deviceCode && !sensorId)) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: sensorId/deviceCode y temperature' },
        { status: 400 }
      );
    }

    const sensor = await prisma.temperatureSensor.findFirst({
      where: {
        OR: [
          ...(sensorId ? [{ id: sensorId }] : []),
          ...(deviceCode ? [{ deviceCode: String(deviceCode).toUpperCase() }] : []),
        ],
        ...(brandId ? { brandId } : {}),
      },
      include: {
        warehouse: {
          include: {
            stocks: {
              include: { ingredient: true },
            },
          },
        },
      },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 });
    }

    const tempVal = parseFloat(temperature);
    const humVal = humidity !== undefined ? parseFloat(humidity) : sensor.currentHumidity;
    const battVal = battery !== undefined ? parseInt(battery, 10) : sensor.batteryLevel;

    // Evaluate HACCP temperature ranges
    let readingStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    let ruleViolated: string | null = null;

    if (tempVal > sensor.targetTempMax) {
      const overDeviation = tempVal - sensor.targetTempMax;
      if (overDeviation >= 3.0) {
        readingStatus = 'CRITICAL';
        ruleViolated = `TEMPERATURA CRÍTICA: ${tempVal.toFixed(1)}°C supera límite máximo (${sensor.targetTempMax}°C) por +${overDeviation.toFixed(1)}°C`;
      } else {
        readingStatus = 'WARNING';
        ruleViolated = `DESVIACIÓN TÉRMICA: ${tempVal.toFixed(1)}°C excede límite (${sensor.targetTempMax}°C)`;
      }
    } else if (tempVal < sensor.targetTempMin) {
      const underDeviation = sensor.targetTempMin - tempVal;
      if (underDeviation >= 4.0 && sensor.sensorType !== 'FREEZER') {
        readingStatus = 'WARNING';
        ruleViolated = `TEMPERATURA BAJO RANGO: ${tempVal.toFixed(1)}°C inferior al mínimo (${sensor.targetTempMin}°C)`;
      }
    }

    // Check battery level alert
    if (battVal !== null && battVal !== undefined && battVal < 15) {
      if (readingStatus === 'NORMAL') {
        readingStatus = 'WARNING';
        ruleViolated = `BATERÍA CRÍTICA DE SENSOR: ${battVal}% restante`;
      }
    }

    const now = new Date();

    // Calculate inventory value at risk
    let inventoryValueAtRisk = 0;
    if (sensor.warehouse?.stocks) {
      for (const ws of sensor.warehouse.stocks) {
        if (ws.stock > 0 && ws.ingredient?.cost) {
          inventoryValueAtRisk += ws.stock * ws.ingredient.cost;
        }
      }
    }

    // Atomic transaction: update sensor + insert reading + create alert if critical/warning
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update current sensor state
      const updatedSensor = await tx.temperatureSensor.update({
        where: { id: sensor.id },
        data: {
          currentTemp: tempVal,
          currentHumidity: humVal,
          batteryLevel: battVal,
          status: readingStatus,
          lastReadingAt: now,
        },
      });

      // 2. Insert historical reading
      const reading = await tx.sensorReading.create({
        data: {
          sensorId: sensor.id,
          temperature: tempVal,
          humidity: humVal,
          battery: battVal,
          status: readingStatus,
          recordedAt: now,
        },
      });

      // 3. Create or escalate alert if abnormal
      let alert = null;
      if (readingStatus === 'CRITICAL' || readingStatus === 'WARNING') {
        // Check if there is already an active alert for this sensor to avoid spamming
        const existingActiveAlert = await tx.temperatureAlert.findFirst({
          where: {
            sensorId: sensor.id,
            status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
          },
        });

        if (!existingActiveAlert) {
          alert = await tx.temperatureAlert.create({
            data: {
              sensorId: sensor.id,
              brandId: sensor.brandId,
              severity: readingStatus,
              temperature: tempVal,
              ruleViolated: ruleViolated || 'DESVIACIÓN TÉRMICA HACCP DETECTADA',
              durationMinutes: 1,
              inventoryValueAtRisk,
              status: 'ACTIVE',
            },
          });
        } else if (readingStatus === 'CRITICAL' && existingActiveAlert.severity !== 'CRITICAL') {
          // Escalate existing warning to critical
          alert = await tx.temperatureAlert.update({
            where: { id: existingActiveAlert.id },
            data: {
              severity: 'CRITICAL',
              temperature: tempVal,
              ruleViolated: ruleViolated || existingActiveAlert.ruleViolated,
              inventoryValueAtRisk,
            },
          });
        }
      }

      return { updatedSensor, reading, alert };
    });

    if (result.alert) {
      await recordAuditLog({
        brandId: sensor.brandId,
        userId: session?.userId || 'IOT_DAEMON',
        action: 'COLD_CHAIN_ALERT_TRIGGERED',
        entityType: 'WAREHOUSE',
        entityId: sensor.id,
        severity: readingStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        details: {
          sensorName: sensor.name,
          temperature: tempVal,
          ruleViolated,
          inventoryValueAtRisk,
          warehouseName: sensor.warehouse?.name || 'Almacén General',
        },
        req,
      });
    }

    return NextResponse.json({
      success: true,
      sensor: result.updatedSensor,
      reading: result.reading,
      alert: result.alert,
    });
  } catch (error: any) {
    console.error('Error recording sensor reading:', error);
    return NextResponse.json(
      { error: 'Error al registrar lectura telemétrica', details: error.message },
      { status: 500 }
    );
  }
}
