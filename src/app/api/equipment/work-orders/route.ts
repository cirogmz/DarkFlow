import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { getDefaultChecklist } from '@/lib/equipmentMaintenance';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const url = new URL(req.url);
    const equipmentId = url.searchParams.get('equipmentId');
    const status = url.searchParams.get('status');
    const orderType = url.searchParams.get('orderType');
    const priority = url.searchParams.get('priority');

    const where: any = { brandId: activeBrandId };
    if (equipmentId) where.equipmentId = equipmentId;
    if (status && status !== 'ALL') where.status = status;
    if (orderType && orderType !== 'ALL') where.orderType = orderType;
    if (priority && priority !== 'ALL') where.priority = priority;

    const workOrders = await prisma.maintenanceWorkOrder.findMany({
      where,
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            location: true,
            status: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ success: true, workOrders });
  } catch (error: unknown) {
    console.error('Error fetching maintenance work orders:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes de trabajo' }, { status: 500 });
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
      equipmentId,
      orderType = 'PREVENTIVE',
      priority = 'MEDIUM',
      title,
      description,
      symptomsOrFailure,
      technicianName,
      serviceCompany,
      scheduledDate,
      checklistJson,
    } = body;

    if (!equipmentId || !title || !description) {
      return NextResponse.json(
        { error: 'Equipo, título y descripción son obligatorios' },
        { status: 400 }
      );
    }

    const equipment = await prisma.kitchenEquipment.findFirst({
      where: { id: equipmentId, brandId: activeBrandId },
    });

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    // Generate unique sequential folio: OT-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const countThisYear = await prisma.maintenanceWorkOrder.count({
      where: {
        brandId: activeBrandId,
        folio: { startsWith: `OT-${currentYear}` },
      },
    });
    const folio = `OT-${currentYear}-${String(countThisYear + 1).padStart(4, '0')}`;

    // Default checklist if not provided
    let finalChecklist = checklistJson;
    if (!finalChecklist) {
      const defaultItems = getDefaultChecklist(equipment.category);
      finalChecklist = JSON.stringify(defaultItems);
    }

    const workOrder = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceWorkOrder.create({
        data: {
          brandId: activeBrandId,
          equipmentId,
          folio,
          orderType,
          priority,
          status: 'SCHEDULED',
          title: title.trim(),
          description: description.trim(),
          symptomsOrFailure: symptomsOrFailure?.trim() || null,
          technicianName: technicianName?.trim() || equipment.vendorName || null,
          serviceCompany: serviceCompany?.trim() || equipment.vendorName || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
          checklistJson: typeof finalChecklist === 'string' ? finalChecklist : JSON.stringify(finalChecklist),
          reportedById: session.userId,
          reportedByName: session.name || 'Jefe de Cocina',
        },
        include: {
          equipment: true,
        },
      });

      // If Emergency or Breakdown, automatically mark equipment as UNDER_REPAIR
      if (orderType === 'EMERGENCY_BREAKDOWN' || priority === 'EMERGENCY') {
        await tx.kitchenEquipment.update({
          where: { id: equipmentId },
          data: { status: 'UNDER_REPAIR' },
        });
      } else if (orderType === 'PREVENTIVE') {
        await tx.kitchenEquipment.update({
          where: { id: equipmentId },
          data: { status: 'MAINTENANCE_REQUIRED' },
        });
      }

      return created;
    });

    await recordAuditLog({
      action: 'WORK_ORDER_CREATED',
      entityType: 'EQUIPMENT_WORK_ORDER',
      entityId: workOrder.id,
      details: {
        folio: workOrder.folio,
        equipmentCode: equipment.code,
        orderType: workOrder.orderType,
        priority: workOrder.priority,
      },
      severity: priority === 'EMERGENCY' ? 'WARNING' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, workOrder });
  } catch (error: unknown) {
    console.error('Error creating maintenance work order:', error);
    return NextResponse.json({ error: 'Error al generar la orden de trabajo' }, { status: 500 });
  }
}
