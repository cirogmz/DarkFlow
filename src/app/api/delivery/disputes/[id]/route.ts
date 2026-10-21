import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const existing = await prisma.deliveryDispute.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 });
    }

    const {
      status, // OPEN | SUBMITTED_TO_APP | RESOLVED_WON | RESOLVED_LOST
      recoveredAmount,
      resolutionNotes,
      ticketFolio,
    } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (ticketFolio !== undefined) updateData.ticketFolio = ticketFolio;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (recoveredAmount !== undefined) {
      updateData.recoveredAmount = parseFloat(Number(recoveredAmount).toFixed(2));
    }

    if (status === 'RESOLVED_WON' || status === 'RESOLVED_LOST') {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.deliveryDispute.update({
      where: { id },
      data: updateData,
    });

    // If dispute won and order linked, update order status
    if (status === 'RESOLVED_WON' && existing.orderId) {
      await prisma.order.update({
        where: { id: existing.orderId },
        data: { reconciliationStatus: 'RECONCILED' },
      });
    }

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'DELIVERY_DISPUTE_UPDATED',
      entityType: 'DeliveryDispute',
      entityId: id,
      severity: status === 'RESOLVED_WON' ? 'INFO' : 'WARNING',
      details: {
        ticketFolio: updated.ticketFolio,
        status: updated.status,
        claimedAmount: updated.claimedAmount,
        recoveredAmount: updated.recoveredAmount,
      },
    });

    return NextResponse.json({
      dispute: updated,
      message: `Disputa actualizada a estado: ${updated.status}`,
    });
  } catch (error: any) {
    console.error('Error updating delivery dispute:', error);
    return NextResponse.json({ error: error.message || 'Error interno al actualizar disputa' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const existing = await prisma.deliveryDispute.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 });
    }

    await prisma.deliveryDispute.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Disputa eliminada correctamente',
    });
  } catch (error: any) {
    console.error('Error deleting dispute:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar disputa' }, { status: 500 });
  }
}
