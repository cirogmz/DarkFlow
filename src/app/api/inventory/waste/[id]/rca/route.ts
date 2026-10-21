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

    const {
      rcaCategory,
      rcaWhys,
      correctiveAction,
      capaStatus,
      capaAssignee,
      capaDueDate,
      capaResolutionNotes,
    } = body;

    const existingLog = await prisma.wasteLog.findFirst({
      where: {
        id,
        brandId: activeBrandId,
      },
      include: {
        ingredient: true,
      },
    });

    if (!existingLog) {
      return NextResponse.json({ error: 'Registro de merma no encontrado' }, { status: 404 });
    }

    const updateData: any = {};
    if (rcaCategory !== undefined) updateData.rcaCategory = rcaCategory;
    if (rcaWhys !== undefined) {
      updateData.rcaWhys = typeof rcaWhys === 'string' ? rcaWhys : JSON.stringify(rcaWhys);
    }
    if (correctiveAction !== undefined) updateData.correctiveAction = correctiveAction;
    if (capaAssignee !== undefined) updateData.capaAssignee = capaAssignee;
    if (capaDueDate !== undefined) updateData.capaDueDate = capaDueDate ? new Date(capaDueDate) : null;
    if (capaResolutionNotes !== undefined) updateData.capaResolutionNotes = capaResolutionNotes;

    if (capaStatus !== undefined) {
      updateData.capaStatus = capaStatus;
      if (capaStatus === 'RESOLVED') {
        updateData.capaResolvedAt = new Date();
        updateData.capaResolvedById = session.userId;
        updateData.capaResolvedByName = session.name || 'Gerencia de Operaciones';
      }
    }

    const updatedLog = await prisma.wasteLog.update({
      where: { id },
      data: updateData,
      include: {
        ingredient: true,
        warehouse: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await recordAuditLog({
      action: capaStatus === 'RESOLVED' ? 'WASTE_CAPA_RESOLVED' : 'WASTE_CAPA_UPDATED',
      entityType: 'INGREDIENT',
      entityId: existingLog.ingredientId,
      details: {
        wasteLogId: id,
        ingredientName: existingLog.ingredient.name,
        capaStatus: updatedLog.capaStatus,
        rcaCategory: updatedLog.rcaCategory,
        correctiveAction: updatedLog.correctiveAction,
        resolvedBy: updatedLog.capaResolvedByName,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Plan de acción y análisis causa-raíz actualizado exitosamente',
      wasteLog: updatedLog,
    });
  } catch (error: any) {
    console.error('Error updating waste RCA/CAPA:', error);
    return NextResponse.json(
      { error: 'Error al actualizar análisis causa-raíz', details: error.message },
      { status: 500 }
    );
  }
}
