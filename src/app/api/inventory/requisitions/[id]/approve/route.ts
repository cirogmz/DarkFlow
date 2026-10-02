import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export async function POST(
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
    const body = await req.json();
    const { action = 'APPROVE', approvedItems, rejectionReason, notes } = body;

    const requisition = await prisma.internalRequisition.findFirst({
      where: { id, brandId: session.activeBrandId },
      include: { items: true },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisición no encontrada' }, { status: 404 });
    }

    if (requisition.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `No se puede procesar una requisición en estado ${requisition.status}` },
        { status: 400 }
      );
    }

    if (action === 'REJECT') {
      const updated = await prisma.internalRequisition.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Rechazado por supervisión',
        },
      });

      await recordAuditLog({
        brandId: session.activeBrandId,
        userId: session.userId,
        action: 'INTERNAL_REQUISITION_REJECTED',
        entityType: 'REQUISITION',
        entityId: id,
        severity: 'WARNING',
        details: `Requisición ${requisition.folio} fue rechazada por ${session.name}. Motivo: ${rejectionReason || 'No especificado'}`,
        req,
      });

      return NextResponse.json(updated);
    }

    // Aprobación: Actualizar cantidades autorizadas por insumo
    const approvedQtyMap = new Map<string, number>();
    if (Array.isArray(approvedItems)) {
      for (const it of approvedItems) {
        approvedQtyMap.set(it.itemId, Number(it.approvedQty) || 0);
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      let totalApprovedCost = 0;

      for (const item of requisition.items) {
        const approvedQty = approvedQtyMap.has(item.id)
          ? approvedQtyMap.get(item.id)!
          : item.requestedQty;

        totalApprovedCost += approvedQty * item.unitCost;

        await tx.requisitionItem.update({
          where: { id: item.id },
          data: { approvedQty },
        });
      }

      return tx.internalRequisition.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: session.userId,
          approvedAt: new Date(),
          totalEstimatedCost: Number(totalApprovedCost.toFixed(2)),
          notes: notes ? `${requisition.notes || ''} [Aprobación: ${notes}]` : requisition.notes,
        },
        include: {
          items: {
            include: { ingredient: true },
          },
          fromWarehouse: true,
          toWarehouse: true,
          requestedBy: true,
          approvedBy: true,
        },
      });
    });

    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'INTERNAL_REQUISITION_APPROVED',
      entityType: 'REQUISITION',
      entityId: id,
      severity: 'INFO',
      details: `Requisición ${requisition.folio} aprobada por ${session.name}. Total autorizado: $${result.totalEstimatedCost.toFixed(2)}.`,
      req,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error approving requisition:', error);
    return NextResponse.json(
      { error: 'Error al autorizar requisición', details: error.message },
      { status: 500 }
    );
  }
}
