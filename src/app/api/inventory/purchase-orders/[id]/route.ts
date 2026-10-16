import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

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
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, brandId: session.activeBrandId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        receivedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ purchaseOrder: po });
  } catch (error: unknown) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
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
    const { status, expectedDate, paymentTerms, notes, rejectionReason, invoiceRef } = body;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    // Do not allow editing if already fully received
    if (existing.status === 'RECEIVED' && status && status !== 'RECEIVED') {
      return NextResponse.json({ error: 'No se puede modificar una orden ya recibida' }, { status: 400 });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: status || existing.status,
        expectedDate: expectedDate !== undefined ? (expectedDate ? new Date(expectedDate) : null) : existing.expectedDate,
        paymentTerms: paymentTerms !== undefined ? paymentTerms : existing.paymentTerms,
        notes: notes !== undefined ? notes : existing.notes,
        rejectionReason: rejectionReason !== undefined ? rejectionReason : existing.rejectionReason,
        invoiceRef: invoiceRef !== undefined ? invoiceRef : existing.invoiceRef,
      },
      include: {
        supplier: true,
        items: {
          include: { ingredient: true },
        },
      },
    });

    await recordAuditLog({
      action: 'PURCHASE_ORDER_UPDATED',
      entityType: 'PURCHASE_ORDER',
      entityId: updated.id,
      details: { folio: updated.folio, previousStatus: existing.status, newStatus: updated.status },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (error: unknown) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Error al actualizar orden de compra' }, { status: 500 });
  }
}
