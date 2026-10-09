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

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { status, resolutionNotes } = body;

    const existing = await prisma.securityIncident.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
    }

    const updated = await prisma.securityIncident.update({
      where: { id },
      data: {
        status: status || existing.status,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        reviewedAt: new Date(),
        reviewedById: session.userId,
      },
    });

    await recordAuditLog({
      action: 'SECURITY_INCIDENT_REVIEWED',
      entityType: 'SECURITY_INCIDENT',
      entityId: updated.id,
      severity: status === 'CONFIRMED_FRAUD' ? 'CRITICAL' : 'INFO',
      details: `Incidente antifraude dictaminado como [${updated.status}] por ${session.email}. Notas: "${resolutionNotes || 'Sin notas'}"`,
      brandId: existing.brandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, incident: updated });
  } catch (error) {
    console.error('Error updating security incident resolution:', error);
    return NextResponse.json({ error: 'Error al dictaminar incidente' }, { status: 500 });
  }
}
