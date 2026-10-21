import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json'; // json | csv
    const warehouseId = searchParams.get('warehouseId');
    const type = searchParams.get('type'); // RAW | PREPARED | ALL

    const whereClause: any = {
      brandId: session.activeBrandId,
    };

    if (type === 'RAW') {
      whereClause.type = 'RAW';
    } else if (type === 'PREPARED') {
      whereClause.type = 'PREPARED';
    }

    const ingredients = await prisma.ingredient.findMany({
      where: whereClause,
      include: {
        warehouseStocks: warehouseId ? { where: { warehouseId } } : false,
      },
      orderBy: { name: 'asc' },
    });

    const brand = await prisma.brand.findUnique({
      where: { id: session.activeBrandId },
      select: { name: true },
    });

    if (format === 'csv') {
      const header = 'ID,Insumo,Tipo,Unidad,Costo Unitario ($),Conteo Fisico 1,Conteo Fisico 2,Discrepancia,Notas / Anaquel\n';
      const rows = ingredients.map((ing) => {
        const cleanName = `"${ing.name.replace(/"/g, '""')}"`;
        const ingType = ing.type === 'PREPARED' ? 'Sub-Receta' : 'Materia Prima';
        return `"${ing.id}",${cleanName},"${ingType}","${ing.unit}",${ing.cost.toFixed(2)},,,,""`;
      });

      const csvContent = '\uFEFF' + header + rows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hoja_toma_ciega_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      brandName: brand?.name || 'DarkFlow',
      generatedAt: new Date().toISOString(),
      ingredients: ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        type: ing.type,
        unit: ing.unit,
        cost: ing.cost,
        allergens: ing.allergens,
      })),
    });
  } catch (error: any) {
    console.error('Error generating audit worksheet:', error);
    return NextResponse.json(
      { error: 'Error al generar hoja de toma física de inventario', details: error.message },
      { status: 500 }
    );
  }
}
