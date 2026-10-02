import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { generateAuditFolio } from '@/lib/costAudit';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const audits = await prisma.inventoryAudit.findMany({
      where: { brandId: session.activeBrandId },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        conductedBy: { select: { id: true, name: true, role: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(audits);
  } catch (error: any) {
    console.error('Error fetching inventory audits:', error);
    return NextResponse.json(
      { error: 'Error al listar auditorías de inventario', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      type = 'BLIND',
      warehouseId,
      notes,
      items, // Array of { ingredientId: string, countedStock: number, notes?: string }
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un insumo en el arqueo físico' },
        { status: 400 }
      );
    }

    // 1. Obtener los ingredientes involucrados para tomar la foto del stock actual y costo
    const ingredientIds = items.map((i: any) => i.ingredientId);
    const dbIngredients = await prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        brandId: session.activeBrandId,
      },
    });

    const ingMap = new Map<string, any>(dbIngredients.map((ing: any) => [ing.id, ing]));

    let totalExpectedValue = 0;
    let totalCountedValue = 0;
    let totalDiscrepancyValue = 0;

    const auditItemsData: Array<{
      ingredientId: string;
      expectedStock: number;
      countedStock: number;
      discrepancy: number;
      unitCost: number;
      discrepancyCost: number;
      notes?: string;
    }> = [];

    for (const item of items) {
      const ing = ingMap.get(item.ingredientId);
      if (!ing) continue;

      const expectedStock = ing.stock;
      const countedStock = Number(item.countedStock) || 0;
      const discrepancy = countedStock - expectedStock;
      const unitCost = ing.cost || 0;
      const discrepancyCost = discrepancy * unitCost;

      totalExpectedValue += expectedStock * unitCost;
      totalCountedValue += countedStock * unitCost;
      totalDiscrepancyValue += discrepancyCost;

      auditItemsData.push({
        ingredientId: ing.id,
        expectedStock,
        countedStock,
        discrepancy,
        unitCost,
        discrepancyCost,
        notes: item.notes,
      });
    }

    const auditNumber = await generateAuditFolio(session.activeBrandId);

    const audit = await prisma.inventoryAudit.create({
      data: {
        brandId: session.activeBrandId,
        auditNumber,
        type,
        status: 'COMPLETED',
        warehouseId: warehouseId || null,
        totalExpectedValue: Number(totalExpectedValue.toFixed(2)),
        totalCountedValue: Number(totalCountedValue.toFixed(2)),
        totalDiscrepancyValue: Number(totalDiscrepancyValue.toFixed(2)),
        notes,
        conductedById: session.userId,
        items: {
          create: auditItemsData,
        },
      },
      include: {
        items: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true, cost: true } },
          },
        },
        warehouse: true,
        conductedBy: { select: { id: true, name: true, role: true } },
      },
    });

    // Registrar en auditoría general de seguridad
    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'INVENTORY_AUDIT_CREATED',
      entityType: 'INVENTORY_AUDIT',
      entityId: audit.id,
      severity: Math.abs(totalDiscrepancyValue) > 500 ? 'WARNING' : 'INFO',
      details: `Auditoría física ${auditNumber} creada. Conteo: $${totalCountedValue.toFixed(2)} vs Esperado: $${totalExpectedValue.toFixed(2)}. Diferencia: $${totalDiscrepancyValue.toFixed(2)}.`,
      req,
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (error: any) {
    console.error('Error creating inventory audit:', error);
    return NextResponse.json(
      { error: 'Error al registrar auditoría física de inventario', details: error.message },
      { status: 500 }
    );
  }
}
