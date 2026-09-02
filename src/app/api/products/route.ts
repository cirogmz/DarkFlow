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

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('all') === 'true';

    const productWhere = includeInactive
      ? { brandId: session.activeBrandId }
      : { brandId: session.activeBrandId, isActive: true };

    // Fetch categories with their products for the active brand
    const categories = await prisma.category.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        products: {
          where: productWhere,
          include: {
            recipeItems: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all products individually for search/filtering
    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        category: true,
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ categories, products });
  } catch (error: unknown) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { name, description, price, categoryId, imageUrl, isActive = true } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre del platillo es requerido' }, { status: 400 });
    }

    if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Debes seleccionar una categoría' }, { status: 400 });
    }

    // Verify category belongs to active brand
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Categoría no válida para esta marca' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        price: parseFloat(price),
        categoryId,
        brandId: session.activeBrandId,
        imageUrl: imageUrl ? imageUrl.trim() : null,
        isActive: Boolean(isActive),
      },
      include: {
        category: true,
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Error al crear platillo' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { id, name, description, price, categoryId, imageUrl, isActive } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de platillo requerido' }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing || existing.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Platillo no encontrado o no autorizado' }, { status: 404 });
    }

    if (categoryId && categoryId !== existing.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat || cat.brandId !== session.activeBrandId) {
        return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        categoryId: categoryId !== undefined ? categoryId : undefined,
        imageUrl: imageUrl !== undefined ? (imageUrl ? imageUrl.trim() : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: {
        category: true,
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: unknown) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Error al actualizar platillo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ error: 'ID de platillo requerido' }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing || existing.brandId !== session.activeBrandId) {
      return NextResponse.json({ error: 'Platillo no encontrado o no autorizado' }, { status: 404 });
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: unknown) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Error al eliminar platillo' }, { status: 500 });
  }
}
