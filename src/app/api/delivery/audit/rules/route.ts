import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'brandId es requerido' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        uberCommissionRate: true,
        rappiCommissionRate: true,
        didiCommissionRate: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      brandId: brand.id,
      brandName: brand.name,
      uberCommissionRate: brand.uberCommissionRate ?? 22.0,
      rappiCommissionRate: brand.rappiCommissionRate ?? 20.0,
      didiCommissionRate: brand.didiCommissionRate ?? 18.0,
    });
  } catch (error: any) {
    console.error('Error al obtener tasas de comisión delivery:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandId, uberCommissionRate, rappiCommissionRate, didiCommissionRate } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId es requerido' }, { status: 400 });
    }

    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: {
        uberCommissionRate: uberCommissionRate !== undefined ? parseFloat(uberCommissionRate) : undefined,
        rappiCommissionRate: rappiCommissionRate !== undefined ? parseFloat(rappiCommissionRate) : undefined,
        didiCommissionRate: didiCommissionRate !== undefined ? parseFloat(didiCommissionRate) : undefined,
      },
      select: {
        id: true,
        name: true,
        uberCommissionRate: true,
        rappiCommissionRate: true,
        didiCommissionRate: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error al actualizar tasas de comisión delivery:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
