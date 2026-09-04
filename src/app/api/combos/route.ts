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
    const onlyActive = searchParams.get('active') === 'true';

    const whereClause: {
      brandId: string;
      isActive?: boolean;
    } = {
      brandId: session.activeBrandId,
    };

    if (onlyActive) {
      whereClause.isActive = true;
    }

    const combos = await prisma.combo.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute original total value and savings for each combo
    const enrichedCombos = combos.map((combo) => {
      const originalPrice = combo.items.reduce((sum, item) => {
        return sum + (item.product.price * item.quantity);
      }, 0);
      const savings = Math.max(0, originalPrice - combo.price);
      const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

      return {
        ...combo,
        originalPrice: parseFloat(originalPrice.toFixed(2)),
        savings: parseFloat(savings.toFixed(2)),
        savingsPercent,
      };
    });

    return NextResponse.json({ combos: enrichedCombos });
  } catch (error: unknown) {
    console.error('Error fetching combos:', error);
    return NextResponse.json({ error: 'Error al obtener combos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, price, imageUrl, items } = body;

    if (!name || price === undefined || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nombre, precio y al menos un producto son requeridos' }, { status: 400 });
    }

    const comboPrice = parseFloat(String(price));
    if (isNaN(comboPrice) || comboPrice < 0) {
      return NextResponse.json({ error: 'El precio del combo debe ser un número válido mayor o igual a 0' }, { status: 400 });
    }

    const combo = await prisma.combo.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        price: comboPrice,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        brandId: session.activeBrandId,
        isActive: true,
        items: {
          create: items.map((item: { productId: string; quantity?: number }) => ({
            productId: item.productId,
            quantity: Math.max(1, parseInt(String(item.quantity || 1), 10)),
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, combo }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating combo:', error);
    return NextResponse.json({ error: 'Error al crear combo' }, { status: 500 });
  }
}
