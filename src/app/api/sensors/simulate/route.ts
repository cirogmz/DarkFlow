import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();
    const { action, sensorId } = body;

    // 1. SEED DEFAULT SENSORS IF BRAND HAS ZERO
    if (action === 'SEED_SENSORS') {
      const existing = await prisma.temperatureSensor.count({
        where: { brandId: activeBrandId },
      });

      if (existing > 0) {
        return NextResponse.json({ message: 'La marca ya cuenta con sensores configurados' });
      }

      // Check warehouse
      const warehouse = await prisma.warehouse.findFirst({
        where: { brandId: activeBrandId },
      });

      const defaultSensors = [
        {
          name: 'Cámara Fría Carnes & Lácteos',
          deviceCode: `SENS-CF-${Math.floor(100 + Math.random() * 900)}`,
          sensorType: 'REFRIGERATION',
          targetTempMin: 0.0,
          targetTempMax: 4.0,
          targetHumidityMin: 75.0,
          targetHumidityMax: 90.0,
          currentTemp: 2.3,
          currentHumidity: 82.0,
          batteryLevel: 98,
          status: 'NORMAL',
          warehouseId: warehouse?.id || null,
        },
        {
          name: 'Congelador Central de Proteínas',
          deviceCode: `SENS-CONG-${Math.floor(100 + Math.random() * 900)}`,
          sensorType: 'FREEZER',
          targetTempMin: -24.0,
          targetTempMax: -18.0,
          targetHumidityMin: 60.0,
          targetHumidityMax: 80.0,
          currentTemp: -19.8,
          currentHumidity: 68.0,
          batteryLevel: 94,
          status: 'NORMAL',
          warehouseId: warehouse?.id || null,
        },
        {
          name: 'Mesa Fría Línea de Ensaladas & Pase',
          deviceCode: `SENS-LINE-${Math.floor(100 + Math.random() * 900)}`,
          sensorType: 'LINE_PREP',
          targetTempMin: 0.0,
          targetTempMax: 5.0,
          targetHumidityMin: 70.0,
          targetHumidityMax: 85.0,
          currentTemp: 3.4,
          currentHumidity: 76.0,
          batteryLevel: 88,
          status: 'NORMAL',
          warehouseId: warehouse?.id || null,
        },
      ];

      for (const s of defaultSensors) {
        const created = await prisma.temperatureSensor.create({
          data: {
            ...s,
            brandId: activeBrandId,
            lastReadingAt: new Date(),
          },
        });

        // Insert 12 hours of normal historical readings
        const now = new Date();
        for (let i = 12; i >= 0; i--) {
          const t = new Date(now.getTime() - i * 3600 * 1000);
          const jitter = (Math.random() - 0.5) * 0.8;
          await prisma.sensorReading.create({
            data: {
              sensorId: created.id,
              temperature: Number((s.currentTemp + jitter).toFixed(1)),
              humidity: s.currentHumidity,
              status: 'NORMAL',
              battery: s.batteryLevel,
              recordedAt: t,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: '3 Sensores IoT con telemetría base generados exitosamente',
      });
    }

    // 2. SIMULATE NORMAL OPERATION
    if (action === 'SIMULATE_NORMAL') {
      const sensors = await prisma.temperatureSensor.findMany({
        where: {
          brandId: activeBrandId,
          ...(sensorId ? { id: sensorId } : {}),
        },
      });

      for (const s of sensors) {
        let baseline = s.sensorType === 'FREEZER' ? -19.5 : 2.5;
        const reading = await prisma.sensorReading.create({
          data: {
            sensorId: s.id,
            temperature: baseline,
            humidity: s.currentHumidity || 80,
            status: 'NORMAL',
            battery: s.batteryLevel || 95,
          },
        });

        await prisma.temperatureSensor.update({
          where: { id: s.id },
          data: {
            currentTemp: baseline,
            status: 'NORMAL',
            lastReadingAt: new Date(),
          },
        });
      }

      return NextResponse.json({ success: true, message: 'Sensores restablecidos a rango normal' });
    }

    // 3. SIMULATE THERMAL SPIKE / ALARM
    if (action === 'SIMULATE_SPIKE') {
      const sensor = await prisma.temperatureSensor.findFirst({
        where: {
          brandId: activeBrandId,
          ...(sensorId ? { id: sensorId } : {}),
        },
        include: {
          warehouse: {
            include: { stocks: { include: { ingredient: true } } },
          },
        },
      });

      if (!sensor) {
        return NextResponse.json({ error: 'No hay sensores para simular' }, { status: 404 });
      }

      const spikeTemp = sensor.sensorType === 'FREEZER' ? -9.5 : 8.8; // Critical spike!

      let valueAtRisk = 0;
      if (sensor.warehouse?.stocks) {
        for (const ws of sensor.warehouse.stocks) {
          if (ws.stock > 0 && ws.ingredient?.cost) {
            valueAtRisk += ws.stock * ws.ingredient.cost;
          }
        }
      }

      await prisma.temperatureSensor.update({
        where: { id: sensor.id },
        data: {
          currentTemp: spikeTemp,
          status: 'CRITICAL',
          lastReadingAt: new Date(),
        },
      });

      await prisma.sensorReading.create({
        data: {
          sensorId: sensor.id,
          temperature: spikeTemp,
          humidity: sensor.currentHumidity || 85,
          status: 'CRITICAL',
          battery: sensor.batteryLevel || 90,
        },
      });

      const alert = await prisma.temperatureAlert.create({
        data: {
          sensorId: sensor.id,
          brandId: activeBrandId,
          severity: 'CRITICAL',
          temperature: spikeTemp,
          ruleViolated: `RUPTURA CRÍTICA DE CADENA DE FRÍO: ${spikeTemp}°C detectados (Límite: ${sensor.targetTempMax}°C)`,
          durationMinutes: 15,
          inventoryValueAtRisk: valueAtRisk,
          status: 'ACTIVE',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Pico térmico simulado en ${sensor.name}: ${spikeTemp}°C con alerta crítica detonada`,
        alert,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in sensor simulation:', error);
    return NextResponse.json(
      { error: 'Error al simular telemetría', details: error.message },
      { status: 500 }
    );
  }
}
