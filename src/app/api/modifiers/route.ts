import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const groups = await prisma.modifierGroup.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        options: {
          include: {
            ingredient: true,
          },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ modifierGroups: groups });
  } catch (error) {
    console.error('Error fetching modifier groups:', error);
    return NextResponse.json({ error: 'Error al obtener modificadores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const {
      name,
      minSelect = 0,
      maxSelect = 1,
      isRequired = false,
      options = [],
    } = await req.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del grupo de modificadores es requerido' }, { status: 400 });
    }

    const cleanName = name.trim();
    const existing = await prisma.modifierGroup.findFirst({
      where: {
        name: cleanName,
        brandId: session.activeBrandId,
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Ya existe un grupo de modificadores llamado "${cleanName}"` }, { status: 400 });
    }

    const numMin = parseInt(String(minSelect), 10) || 0;
    const numMax = Math.max(1, parseInt(String(maxSelect), 10) || 1);
    const required = isRequired || numMin > 0;

    const newGroup = await prisma.modifierGroup.create({
      data: {
        name: cleanName,
        minSelect: numMin,
        maxSelect: numMax,
        isRequired: required,
        brandId: session.activeBrandId,
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
        },
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json({ modifierGroup: newGroup }, { status: 201 });
  } catch (error) {
    console.error('Error creating modifier group:', error);
    return NextResponse.json({ error: 'Error al crear grupo de modificadores' }, { status: 500 });
  }
}
