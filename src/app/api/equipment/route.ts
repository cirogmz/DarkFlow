import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { calculateEquipmentHealth, calculateNextMaintenanceDate } from '@/lib/equipmentMaintenance';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const equipmentList = await prisma.kitchenEquipment.findMany({
      where: { brandId: activeBrandId },
      include: {
        _count: {
          select: { workOrders: true },
        },
        workOrders: {
          select: {
            id: true,
            folio: true,
            orderType: true,
            priority: true,
            status: true,
            totalCost: true,
            downtimeHours: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: [
        { status: 'asc' },
        { criticality: 'desc' },
        { name: 'asc' },
      ],
    });

    // Compute health metrics and KPI rollups
    let totalAssets = equipmentList.length;
    let operationalCount = 0;
    let underRepairCount = 0;
    let maintenanceRequiredCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let totalYtdCost = 0;
    let totalDowntime = 0;

    const now = new Date();

    const enrichedEquipment = equipmentList.map((eq) => {
      const health = calculateEquipmentHealth(eq, eq.workOrders, now);

      if (eq.status === 'OPERATIONAL') operationalCount++;
      else if (eq.status === 'UNDER_REPAIR') underRepairCount++;
      else if (eq.status === 'MAINTENANCE_REQUIRED') maintenanceRequiredCount++;

      if (health.preventiveStatus === 'OVERDUE') overdueCount++;
      else if (health.preventiveStatus === 'DUE_SOON') dueSoonCount++;

      totalYtdCost += health.totalMaintenanceCost;
      totalDowntime += health.totalDowntimeHours;

      return {
        ...eq,
        health,
      };
    });

    return NextResponse.json({
      success: true,
      equipment: enrichedEquipment,
      kpis: {
        totalAssets,
        operationalCount,
        underRepairCount,
        maintenanceRequiredCount,
        overdueCount,
        dueSoonCount,
        totalYtdCost: Math.round(totalYtdCost * 100) / 100,
        totalDowntimeHours: Math.round(totalDowntime * 10) / 10,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching kitchen equipment:', error);
    return NextResponse.json({ error: 'Error al obtener equipos de cocina' }, { status: 500 });
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
      code,
      category = 'COOKING',
      location = 'Cocina Principal',
      brandModel,
      serialNumber,
      vendorName,
      vendorContact,
      criticality = 'HIGH',
      purchaseDate,
      purchaseCost = 0,
      warrantyExpiration,
      maintenanceFrequencyDays = 90,
      notes,
    } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'El nombre y código del equipo son obligatorios' },
        { status: 400 }
      );
    }

    // Auto-schedule initial nextMaintenanceDate
    const freqDays = parseInt(String(maintenanceFrequencyDays), 10) || 90;
    const nextMaintenanceDate = calculateNextMaintenanceDate(new Date(), freqDays);

    const newEquipment = await prisma.kitchenEquipment.create({
      data: {
        brandId: activeBrandId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        location: location?.trim() || 'Cocina Principal',
        brandModel: brandModel?.trim() || null,
        serialNumber: serialNumber?.trim() || null,
        vendorName: vendorName?.trim() || null,
        vendorContact: vendorContact?.trim() || null,
        criticality,
        status: 'OPERATIONAL',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseCost: parseFloat(String(purchaseCost)) || 0,
        warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
        lastMaintenanceDate: null,
        nextMaintenanceDate,
        maintenanceFrequencyDays: freqDays,
        notes: notes?.trim() || null,
      },
    });

    await recordAuditLog({
      action: 'EQUIPMENT_REGISTERED',
      entityType: 'EQUIPMENT',
      entityId: newEquipment.id,
      details: {
        code: newEquipment.code,
        name: newEquipment.name,
        category: newEquipment.category,
        criticality: newEquipment.criticality,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, equipment: newEquipment });
  } catch (error: any) {
    console.error('Error creating kitchen equipment:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un equipo con ese código' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al registrar el equipo' }, { status: 500 });
  }
}
