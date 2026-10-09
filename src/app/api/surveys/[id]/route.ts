import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { status, resolutionNotes } = body;

    const existing = await prisma.satisfactionSurvey.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 });
    }

    const newStatus = status || existing.status;
    const updated = await prisma.satisfactionSurvey.update({
      where: { id },
      data: {
        status: newStatus,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        resolvedAt: newStatus === 'RESOLVED' ? new Date() : (newStatus === 'PENDING_RESOLUTION' ? null : existing.resolvedAt),
        resolvedById: newStatus === 'RESOLVED' ? session.userId : existing.resolvedById,
      },
    });

    // Log recovery action to AuditLog
    if (resolutionNotes || (status && status !== existing.status)) {
      await recordAuditLog({
        action: 'CUSTOMER_RECOVERY_UPDATE',
        entityType: 'SATISFACTION_SURVEY',
        entityId: updated.id,
        severity: 'INFO',
        details: `Gestión de Encuesta en Orden #${existing.order.orderNumber} por ${session.email || 'gerencia'}: Estado [${newStatus}]. ${resolutionNotes ? `Resolución: "${resolutionNotes.slice(0, 160)}"` : ''}`,
        userId: session.userId,
        brandId: existing.brandId,
        req,
      });
    }

    return NextResponse.json({ success: true, survey: updated });
  } catch (error) {
    console.error('Error updating survey resolution:', error);
    return NextResponse.json({ error: 'Error al actualizar resolución de encuesta' }, { status: 500 });
  }
}
