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
    const activeBrandId = session.activeBrandId as string;

    const batch = await prisma.ingredientBatch.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        ingredient: true,
        supplier: true,
        warehouse: true,
        wasteLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, batch });
  } catch (error: unknown) {
    console.error('Error fetching batch:', error);
    return NextResponse.json({ error: 'Error al consultar lote' }, { status: 500 });
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

    const existing = await prisma.ingredientBatch.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    const updateData: any = {};

    if (body.batchNumber) updateData.batchNumber = body.batchNumber.trim();
    if (body.expirationDate) {
      const expDate = new Date(body.expirationDate);
      if (!isNaN(expDate.getTime())) {
        updateData.expirationDate = expDate;
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes ? body.notes.trim() : null;
    if (body.status) updateData.status = body.status;
    if (body.supplierId !== undefined) updateData.supplierId = body.supplierId || null;
    if (body.warehouseId !== undefined) updateData.warehouseId = body.warehouseId || null;

    const updated = await prisma.ingredientBatch.update({
      where: { id },
      data: updateData,
      include: {
        ingredient: true,
        supplier: true,
        warehouse: true,
      },
    });

    await recordAuditLog({
      action: 'BATCH_UPDATED',
      entityType: 'INGREDIENT_BATCH',
      entityId: updated.id,
      details: updateData,
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, batch: updated });
  } catch (error: unknown) {
    console.error('Error updating batch:', error);
    return NextResponse.json({ error: 'Error al actualizar lote' }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await prisma.ingredientBatch.findFirst({
      where: { id, brandId: activeBrandId },
      include: { wasteLogs: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    if (existing.wasteLogs.length > 0) {
      // Cannot hard delete if waste logs exist, mark as DEPLETED/CANCELLED
      const updated = await prisma.ingredientBatch.update({
        where: { id },
        data: { status: 'DEPLETED', currentQuantity: 0 },
      });
      return NextResponse.json({ success: true, message: 'Lote marcado como agotado debido a mermas registradas', batch: updated });
    }

    await prisma.ingredientBatch.delete({
      where: { id },
    });

    await recordAuditLog({
      action: 'BATCH_DELETED',
      entityType: 'INGREDIENT_BATCH',
      entityId: id,
      details: { batchNumber: existing.batchNumber },
      severity: 'WARNING',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, message: 'Lote eliminado exitosamente' });
  } catch (error: unknown) {
    console.error('Error deleting batch:', error);
    return NextResponse.json({ error: 'Error al eliminar lote' }, { status: 500 });
  }
}
