import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
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

    const group = await prisma.modifierGroup.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
      include: {
        options: {
          include: { ingredient: true },
          orderBy: { order: 'asc' },
        },
        products: {
          include: { product: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Grupo de modificadores no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ modifierGroup: group });
  } catch (error) {
    console.error('Error getting modifier group:', error);
    return NextResponse.json({ error: 'Error al obtener grupo de modificadores' }, { status: 500 });
  }
}

export async function PUT(
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

    const existingGroup = await prisma.modifierGroup.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ error: 'Grupo de modificadores no encontrado' }, { status: 404 });
    }

    const {
      name,
      minSelect = 0,
      maxSelect = 1,
      isRequired = false,
      options = [],
    } = await req.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const cleanName = name.trim();
    const numMin = parseInt(String(minSelect), 10) || 0;
    const numMax = Math.max(1, parseInt(String(maxSelect), 10) || 1);
    const required = isRequired || numMin > 0;

    // Transaction to update group and replace options
    const updatedGroup = await prisma.$transaction(async (tx) => {
      // 1. Delete old options
      await tx.modifierOption.deleteMany({
        where: { modifierGroupId: id },
      });

      // 2. Update group and recreate options
      return await tx.modifierGroup.update({
        where: { id },
        data: {
          name: cleanName,
          minSelect: numMin,
          maxSelect: numMax,
          isRequired: required,
          options: {
            create: Array.isArray(options)
              ? options.map((opt: { name: string; price?: number; ingredientId?: string | null; ingredientQuantity?: number | null; isDefault?: boolean; order?: number }, idx: number) => ({
                  name: opt.name?.trim() || `Opción ${idx + 1}`,
                  price: parseFloat(String(opt.price || 0)),
                  ingredientId: opt.ingredientId || null,
                  ingredientQuantity: opt.ingredientQuantity ? parseFloat(String(opt.ingredientQuantity)) : null,
                  isDefault: Boolean(opt.isDefault),
                  order: opt.order ?? idx,
                }))
              : [],
          },
        },
        include: {
          options: {
            include: { ingredient: true },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { products: true },
          },
        },
      });
    });

    return NextResponse.json({ modifierGroup: updatedGroup });
  } catch (error) {
    console.error('Error updating modifier group:', error);
    return NextResponse.json({ error: 'Error al actualizar grupo de modificadores' }, { status: 500 });
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

    const existingGroup = await prisma.modifierGroup.findFirst({
      where: {
        id,
        brandId: session.activeBrandId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ error: 'Grupo de modificadores no encontrado' }, { status: 404 });
    }

    await prisma.modifierGroup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting modifier group:', error);
    return NextResponse.json({ error: 'Error al eliminar grupo de modificadores' }, { status: 500 });
  }
}
