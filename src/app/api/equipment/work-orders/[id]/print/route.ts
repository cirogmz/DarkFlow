import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateWorkOrderTicket, ChecklistItem } from '@/lib/equipmentMaintenance';

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
        brand: { select: { name: true } },
        equipment: true,
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    let parsedChecklist: ChecklistItem[] | null = null;
    if (workOrder.checklistJson) {
      try {
        parsedChecklist = JSON.parse(workOrder.checklistJson);
      } catch {}
    }

    const ticket = generateWorkOrderTicket({
      brandName: workOrder.brand?.name,
      folio: workOrder.folio,
      orderType: workOrder.orderType,
      priority: workOrder.priority,
      status: workOrder.status,
      title: workOrder.title,
      description: workOrder.description,
      equipmentName: workOrder.equipment.name,
      equipmentCode: workOrder.equipment.code,
      equipmentCategory: workOrder.equipment.category,
      equipmentLocation: workOrder.equipment.location,
      technicianName: workOrder.technicianName,
      serviceCompany: workOrder.serviceCompany,
      scheduledDate: workOrder.scheduledDate,
      completedAt: workOrder.completedAt,
      laborCost: workOrder.laborCost,
      partsCost: workOrder.partsCost,
      totalCost: workOrder.totalCost,
      downtimeHours: workOrder.downtimeHours,
      partsReplaced: workOrder.partsReplaced,
      actionTaken: workOrder.actionTaken,
      checklist: parsedChecklist,
      reportedByName: workOrder.reportedByName,
    });

    return NextResponse.json({
      success: true,
      ticket,
      folio: workOrder.folio,
      equipmentName: workOrder.equipment.name,
    });
  } catch (error: unknown) {
    console.error('Error generating work order ticket:', error);
    return NextResponse.json({ error: 'Error al generar ticket de orden de trabajo' }, { status: 500 });
  }
}
