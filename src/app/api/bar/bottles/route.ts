import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);
    const station = searchParams.get('station');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      brandId: activeBrandId,
    };

    if (station && station !== 'ALL') where.station = station;
    if (status && status !== 'ALL') where.status = status;

    const bottles = await prisma.barBottle.findMany({
      where,
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            cost: true,
            unit: true,
            stock: true,
          },
        },
      },
      orderBy: [
        { station: 'asc' },
        { bottleLabel: 'asc' },
      ],
    });

    // Agrupar botellas por estación
    const stations = [...new Set(bottles.map((b) => b.station))];

    return NextResponse.json({
      bottles,
      stations,
      totalCount: bottles.length,
      openCount: bottles.filter((b) => b.status === 'OPEN').length,
    });
  } catch (error: any) {
    console.error('Error al consultar botellas de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
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
      ingredientId,
      bottleLabel,
      station = 'Barra Principal',
      capacityMl = 750,
      currentMl,
      tareWeightGrams = 450,
      densityGramsPerMl = 0.95,
      cost,
      status = 'OPEN',
      openedByName,
    } = body;

    if (!ingredientId || !bottleLabel) {
      return NextResponse.json({ error: 'Insumo y etiqueta de botella son obligatorios' }, { status: 400 });
    }

    // Verificar que el insumo exista
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient || ingredient.brandId !== activeBrandId) {
      return NextResponse.json({ error: 'Insumo no encontrado en esta marca' }, { status: 404 });
    }

    const initialMl = typeof currentMl === 'number' ? currentMl : capacityMl;
    const bottleCost = typeof cost === 'number' ? cost : ingredient.cost;

    const newBottle = await prisma.barBottle.create({
      data: {
        brandId: activeBrandId,
        ingredientId,
        bottleLabel: bottleLabel.trim(),
        station: station.trim(),
        capacityMl: Number(capacityMl),
        currentMl: Number(initialMl),
        tareWeightGrams: Number(tareWeightGrams),
        densityGramsPerMl: Number(densityGramsPerMl),
        cost: Number(bottleCost),
        status,
        openedAt: status === 'OPEN' ? new Date() : null,
        openedByName: openedByName || session.name || null,
      },
      include: {
        ingredient: true,
      },
    });

    return NextResponse.json({
      success: true,
      bottle: newBottle,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error al registrar botella de barra:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
