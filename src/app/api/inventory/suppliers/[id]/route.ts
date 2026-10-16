import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

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
    const {
      name,
      code,
      contactName,
      email,
      phone,
      taxId,
      address,
      paymentTerms,
      leadTimeDays,
      notes,
      isActive,
      ingredientCosts, // Array of { ingredientId, negotiatedCost, supplierSku, isPreferred, minOrderQty }
    } = body;

    const existing = await prisma.supplier.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const sup = await tx.supplier.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : existing.name,
          code: code !== undefined ? (code ? code.trim() : null) : existing.code,
          contactName: contactName !== undefined ? (contactName ? contactName.trim() : null) : existing.contactName,
          email: email !== undefined ? (email ? email.trim() : null) : existing.email,
          phone: phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
          taxId: taxId !== undefined ? (taxId ? taxId.trim().toUpperCase() : null) : existing.taxId,
          address: address !== undefined ? (address ? address.trim() : null) : existing.address,
          paymentTerms: paymentTerms !== undefined ? paymentTerms : existing.paymentTerms,
          leadTimeDays: leadTimeDays !== undefined ? parseInt(leadTimeDays, 10) : existing.leadTimeDays,
          notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
          isActive: isActive !== undefined ? !!isActive : existing.isActive,
        },
      });

      if (Array.isArray(ingredientCosts)) {
        // Delete current relations and recreate
        await tx.ingredientSupplier.deleteMany({
          where: { supplierId: id },
        });

        for (const item of ingredientCosts) {
          if (item.ingredientId && item.negotiatedCost !== undefined) {
            await tx.ingredientSupplier.create({
              data: {
                supplierId: id,
                ingredientId: item.ingredientId,
                negotiatedCost: parseFloat(item.negotiatedCost) || 0,
                supplierSku: item.supplierSku || null,
                isPreferred: !!item.isPreferred,
                minOrderQty: item.minOrderQty ? parseFloat(item.minOrderQty) : 1,
              },
            });
          }
        }
      }

      return sup;
    });

    await recordAuditLog({
      action: 'SUPPLIER_UPDATED',
      entityType: 'SUPPLIER',
      entityId: updated.id,
      details: { name: updated.name, changes: body },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    const fullSupplier = await prisma.supplier.findUnique({
      where: { id: updated.id },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, supplier: fullSupplier });
  } catch (error: unknown) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 });
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

    const supplier = await prisma.supplier.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // If has purchase orders, soft-delete by deactivating
    if (supplier._count.purchaseOrders > 0) {
      await prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: 'Proveedor desactivado (posee historial de órdenes)' });
    }

    // Otherwise complete hard delete
    await prisma.supplier.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Proveedor eliminado permanentemente' });
  } catch (error: unknown) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 });
  }
}
