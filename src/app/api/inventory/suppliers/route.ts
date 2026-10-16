import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        ingredients: {
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                cost: true,
                stock: true,
                parLevel: true,
                reorderPoint: true,
              },
            },
          },
        },
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ suppliers });
  } catch (error: unknown) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

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
      ingredientCosts, // Array of { ingredientId, negotiatedCost, supplierSku, isPreferred, minOrderQty }
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio' }, { status: 400 });
    }

    // Verify uniqueness of name within the brand
    const existing = await prisma.supplier.findFirst({
      where: {
        brandId: activeBrandId,
        name: { equals: name.trim() },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Ya existe un proveedor con este nombre' }, { status: 400 });
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          brandId: activeBrandId,
          name: name.trim(),
          code: code ? code.trim() : null,
          contactName: contactName ? contactName.trim() : null,
          email: email ? email.trim() : null,
          phone: phone ? phone.trim() : null,
          taxId: taxId ? taxId.trim().toUpperCase() : null,
          address: address ? address.trim() : null,
          paymentTerms: paymentTerms || 'CONTADO',
          leadTimeDays: leadTimeDays ? parseInt(leadTimeDays, 10) : 1,
          notes: notes ? notes.trim() : null,
          isActive: true,
        },
      });

      if (Array.isArray(ingredientCosts) && ingredientCosts.length > 0) {
        for (const item of ingredientCosts) {
          if (item.ingredientId && item.negotiatedCost !== undefined) {
            await tx.ingredientSupplier.create({
              data: {
                supplierId: created.id,
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

      return created;
    });

    await recordAuditLog({
      action: 'SUPPLIER_CREATED',
      entityType: 'SUPPLIER',
      entityId: supplier.id,
      details: { name: supplier.name, contactName: supplier.contactName, email: supplier.email },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    const fullSupplier = await prisma.supplier.findUnique({
      where: { id: supplier.id },
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
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Error al registrar proveedor' }, { status: 500 });
  }
}
