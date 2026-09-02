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

    // Fetch categories with their products for the active brand
    const categories = await prisma.category.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        products: {
          where: { isActive: true },
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
      where: { 
        brandId: session.activeBrandId,
        isActive: true,
      },
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
