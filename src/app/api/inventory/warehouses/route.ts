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

    const activeBrandId = session.activeBrandId as string;

    // Check if at least one warehouse exists; if not, create a default "Almacén General"
    let warehouses = await prisma.warehouse.findMany({
      where: { brandId: activeBrandId },
      include: {
        stocks: {
          include: {
            ingredient: true,
          },
        },
        _count: {
          select: {
            transfersFrom: true,
            transfersTo: true,
            wasteLogs: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    if (warehouses.length === 0) {
      const defaultWh = await prisma.warehouse.create({
        data: {
          name: 'Almacén General',
          code: 'ALM-GRAL',
          description: 'Bodega central de almacenamiento principal y secos',
          isDefault: true,
          brandId: activeBrandId,
        },
        include: {
          stocks: {
            include: {
              ingredient: true,
            },
          },
          _count: {
            select: {
              transfersFrom: true,
              transfersTo: true,
              wasteLogs: true,
            },
          },
        },
      });
      warehouses = [defaultWh];
    }

    return NextResponse.json({ warehouses });
  } catch (error: unknown) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Error al consultar almacenes' }, { status: 500 });
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
    const { name, code, description, isDefault } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del almacén es obligatorio' }, { status: 400 });
    }

    // If marked as default, unset other defaults
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { brandId: activeBrandId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : null,
        description: description ? description.trim() : null,
        isDefault: Boolean(isDefault),
        brandId: activeBrandId,
      },
    });

    await recordAuditLog({
      action: 'WAREHOUSE_CREATED',
      entityType: 'WAREHOUSE',
      entityId: warehouse.id,
      details: { name: warehouse.name, code: warehouse.code, isDefault: warehouse.isDefault },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, warehouse });
  } catch (error: unknown) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json({ error: 'Error al crear almacén' }, { status: 500 });
  }
}
