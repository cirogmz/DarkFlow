import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const sensors = await prisma.temperatureSensor.findMany({
      where: { brandId: activeBrandId },
      include: {
        warehouse: {
          include: {
            stocks: {
              include: {
                ingredient: true,
              },
            },
          },
        },
        readings: {
          orderBy: { recordedAt: 'desc' },
          take: 24, // Last 24 readings for sparklines
        },
        alerts: {
          where: { status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    let normalCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let totalValueAtRisk = 0;

    const enrichedSensors = sensors.map((sensor) => {
      // Calculate inventory value inside the linked warehouse
      let warehouseValue = 0;
      if (sensor.warehouse?.stocks) {
        for (const ws of sensor.warehouse.stocks) {
          if (ws.stock > 0 && ws.ingredient?.cost) {
            warehouseValue += ws.stock * ws.ingredient.cost;
          }
        }
      }

      if (sensor.status === 'CRITICAL') {
        criticalCount += 1;
        totalValueAtRisk += warehouseValue;
      } else if (sensor.status === 'WARNING') {
        warningCount += 1;
        totalValueAtRisk += warehouseValue * 0.5; // Estimated 50% risk exposure on warning
      } else {
        normalCount += 1;
      }

      return {
        ...sensor,
        inventoryValue: warehouseValue,
        activeAlertsCount: sensor.alerts.length,
      };
    });

    return NextResponse.json({
      sensors: enrichedSensors,
      summary: {
        totalSensors: sensors.length,
        normalCount,
        warningCount,
        criticalCount,
        totalValueAtRisk,
      },
    });
  } catch (error: any) {
    console.error('Error fetching sensors:', error);
    return NextResponse.json(
      { error: 'Error al consultar sensores de temperatura', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      name,
      deviceCode,
      sensorType,
      targetTempMin,
      targetTempMax,
      targetHumidityMin,
      targetHumidityMax,
      warehouseId,
    } = body;

    if (!name || !deviceCode) {
      return NextResponse.json(
        { error: 'Nombre del sensor y código de dispositivo son obligatorios' },
        { status: 400 }
      );
    }

    const min = targetTempMin !== undefined ? parseFloat(targetTempMin) : 0;
    const max = targetTempMax !== undefined ? parseFloat(targetTempMax) : 4;

    const sensor = await prisma.temperatureSensor.create({
      data: {
        name: String(name).trim(),
        deviceCode: String(deviceCode).trim().toUpperCase(),
        sensorType: sensorType || 'REFRIGERATION',
        targetTempMin: min,
        targetTempMax: max,
        targetHumidityMin: targetHumidityMin ? parseFloat(targetHumidityMin) : null,
        targetHumidityMax: targetHumidityMax ? parseFloat(targetHumidityMax) : null,
        currentTemp: (min + max) / 2, // Default baseline within range
        currentHumidity: targetHumidityMin ? (parseFloat(targetHumidityMin) + parseFloat(targetHumidityMax || '85')) / 2 : 75,
        batteryLevel: 100,
        status: 'NORMAL',
        lastReadingAt: new Date(),
        warehouseId: warehouseId || null,
        brandId: activeBrandId,
      },
      include: {
        warehouse: true,
      },
    });

    // Record baseline reading
    await prisma.sensorReading.create({
      data: {
        sensorId: sensor.id,
        temperature: sensor.currentTemp || 2.0,
        humidity: sensor.currentHumidity || 75,
        status: 'NORMAL',
        battery: 100,
      },
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'TEMPERATURE_SENSOR_CREATED',
      entityType: 'WAREHOUSE',
      entityId: sensor.id,
      severity: 'INFO',
      details: {
        sensorName: sensor.name,
        deviceCode: sensor.deviceCode,
        sensorType: sensor.sensorType,
        targetRange: `${min}°C a ${max}°C`,
        warehouseName: sensor.warehouse?.name || 'Almacén General',
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Sensor de temperatura registrado correctamente',
      sensor,
    });
  } catch (error: any) {
    console.error('Error creating temperature sensor:', error);
    return NextResponse.json(
      { error: 'Error al registrar sensor', details: error.message },
      { status: 500 }
    );
  }
}
