import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { calculateNextMaintenanceDate } from '@/lib/equipmentMaintenance';

export async function GET(
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

    const workOrder = await prisma.maintenanceWorkOrder.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        equipment: true,
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, workOrder });
  } catch (error: unknown) {
    console.error('Error fetching work order:', error);
    return NextResponse.json({ error: 'Error al obtener la orden de trabajo' }, { status: 500 });
  }
}

export async function PUT(
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

    const existing = await prisma.maintenanceWorkOrder.findFirst({
      where: { id, brandId: activeBrandId },
      include: { equipment: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    const {
      status,
      priority,
      orderType,
      title,
      description,
      symptomsOrFailure,
      rootCause,
      actionTaken,
      technicianName,
      serviceCompany,
      laborCost,
      partsCost,
      downtimeHours,
      partsReplaced,
      checklistJson,
      invoiceRef,
      warrantyClaimed,
    } = body;

    const isNowCompleting = status === 'COMPLETED' && existing.status !== 'COMPLETED';
    const isNowStarting = status === 'IN_PROGRESS' && !existing.startedAt;

    const parsedLaborCost = laborCost !== undefined ? parseFloat(String(laborCost)) || 0 : (existing.laborCost || 0);
    const parsedPartsCost = partsCost !== undefined ? parseFloat(String(partsCost)) || 0 : (existing.partsCost || 0);
    const parsedTotalCost = Math.round((parsedLaborCost + parsedPartsCost) * 100) / 100;

    const updated = await prisma.$transaction(async (tx) => {
      const wo = await tx.maintenanceWorkOrder.update({
        where: { id },
        data: {
          status: status !== undefined ? status : existing.status,
          priority: priority !== undefined ? priority : existing.priority,
          orderType: orderType !== undefined ? orderType : existing.orderType,
          title: title !== undefined ? String(title).trim() : existing.title,
          description: description !== undefined ? String(description).trim() : existing.description,
          symptomsOrFailure: symptomsOrFailure !== undefined ? (symptomsOrFailure ? String(symptomsOrFailure).trim() : null) : existing.symptomsOrFailure,
          rootCause: rootCause !== undefined ? (rootCause ? String(rootCause).trim() : null) : existing.rootCause,
          actionTaken: actionTaken !== undefined ? (actionTaken ? String(actionTaken).trim() : null) : existing.actionTaken,
          technicianName: technicianName !== undefined ? (technicianName ? String(technicianName).trim() : null) : existing.technicianName,
          serviceCompany: serviceCompany !== undefined ? (serviceCompany ? String(serviceCompany).trim() : null) : existing.serviceCompany,
          laborCost: parsedLaborCost,
          partsCost: parsedPartsCost,
          totalCost: parsedTotalCost,
          downtimeHours: downtimeHours !== undefined ? parseFloat(String(downtimeHours)) || 0 : existing.downtimeHours,
          partsReplaced: partsReplaced !== undefined ? (partsReplaced ? String(partsReplaced).trim() : null) : existing.partsReplaced,
          checklistJson: checklistJson !== undefined ? (typeof checklistJson === 'string' ? checklistJson : JSON.stringify(checklistJson)) : existing.checklistJson,
          invoiceRef: invoiceRef !== undefined ? (invoiceRef ? String(invoiceRef).trim() : null) : existing.invoiceRef,
          warrantyClaimed: warrantyClaimed !== undefined ? Boolean(warrantyClaimed) : existing.warrantyClaimed,
          startedAt: isNowStarting ? new Date() : existing.startedAt,
          completedAt: isNowCompleting ? new Date() : (status === 'COMPLETED' ? existing.completedAt || new Date() : null),
        },
        include: { equipment: true },
      });

      // If work order is completed, release the equipment back to OPERATIONAL and re-schedule next preventive
      if (isNowCompleting) {
        const nextDate = calculateNextMaintenanceDate(
          new Date(),
          existing.equipment.maintenanceFrequencyDays || 90
        );

        await tx.kitchenEquipment.update({
          where: { id: existing.equipmentId },
          data: {
            status: 'OPERATIONAL',
            lastMaintenanceDate: new Date(),
            nextMaintenanceDate: nextDate,
          },
        });
      }

      return wo;
    });

    await recordAuditLog({
      action: 'WORK_ORDER_UPDATED',
      entityType: 'EQUIPMENT_WORK_ORDER',
      entityId: id,
      details: {
        folio: updated.folio,
        status: updated.status,
        totalCost: updated.totalCost,
        downtimeHours: updated.downtimeHours,
      },
      severity: isNowCompleting ? 'INFO' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: unknown) {
    console.error('Error updating work order:', error);
    return NextResponse.json({ error: 'Error al actualizar la orden de trabajo' }, { status: 500 });
  }
}
