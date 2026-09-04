import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json({ error: 'Slug de marca requerido' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { slug: slug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        isActive: true,
      },
    });

    if (!brand || !brand.isActive) {
      return NextResponse.json({ error: 'Marca no encontrada o inactiva' }, { status: 404 });
    }

    // Fetch categories with active products
    const categories = await prisma.category.findMany({
      where: { brandId: brand.id },
      include: {
        products: {
          where: { isActive: true },
          include: {
            recipeItems: {
              include: {
                ingredient: {
                  select: {
                    id: true,
                    name: true,
                    stock: true,
                    unit: true,
                  },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch active combos
    const combos = await prisma.combo.findMany({
      where: {
        brandId: brand.id,
        isActive: true,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { price: 'asc' },
    });

    // Calculate original price and savings for combos
    const enrichedCombos = combos.map((combo) => {
      const originalPrice = combo.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const savings = Math.max(0, originalPrice - combo.price);
      const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

      return {
        ...combo,
        originalPrice,
        savings,
        savingsPercent,
      };
    });

    // Fetch tables for dine-in selection
    const tables = await prisma.table.findMany({
      where: { brandId: brand.id },
      select: {
        id: true,
        number: true,
        name: true,
        zone: true,
        status: true,
      },
      orderBy: { number: 'asc' },
    });

    return NextResponse.json({
      brand,
      categories,
      combos: enrichedCombos,
      tables,
    });
  } catch (error) {
    console.error('Error fetching public menu:', error);
    return NextResponse.json(
      { error: 'Error al cargar el menú digital' },
      { status: 500 }
    );
  }
}
