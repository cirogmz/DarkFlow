import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let brands;

    if (session.role === 'SUPER_ADMIN') {
      // Super admin can access all brands
      brands = await prisma.brand.findMany({
        orderBy: { name: 'asc' },
      });
    } else {
      // Return brands assigned to this user
      brands = await prisma.brand.findMany({
        where: {
          id: { in: session.brandIds },
        },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ brands });
  } catch (error: unknown) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado para crear marcas' }, { status: 403 });
    }

    const { name, primaryColor, secondaryColor, logoUrl } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre de la marca es requerido' }, { status: 400 });
    }

    const baseSlug = name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    const existingSlug = await prisma.brand.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const brand = await prisma.$transaction(async (tx) => {
      const newBrand = await tx.brand.create({
        data: {
          name: name.trim(),
          slug,
          primaryColor: primaryColor || '#F59E0B',
          secondaryColor: secondaryColor || '#1E293B',
          logoUrl: logoUrl || null,
          isActive: true,
        },
      });

      // Link new brand to user
      await tx.userBrand.create({
        data: {
          userId: session.userId,
          brandId: newBrand.id,
        },
      });

      return newBrand;
    });

    return NextResponse.json({ success: true, brand });
  } catch (error: unknown) {
    console.error('Error creating brand:', error);
    return NextResponse.json({ error: 'Error al crear marca' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id, name, primaryColor, secondaryColor, logoUrl, isActive } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de marca requerido' }, { status: 400 });
    }

    if (session.role !== 'SUPER_ADMIN' && !session.brandIds.includes(id)) {
      return NextResponse.json({ error: 'No tienes permisos para modificar esta marca' }, { status: 403 });
    }

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        primaryColor: primaryColor !== undefined ? primaryColor : undefined,
        secondaryColor: secondaryColor !== undefined ? secondaryColor : undefined,
        logoUrl: logoUrl !== undefined ? logoUrl : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({ success: true, brand: updated });
  } catch (error: unknown) {
    console.error('Error updating brand:', error);
    return NextResponse.json({ error: 'Error al actualizar marca' }, { status: 500 });
  }
}
