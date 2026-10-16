import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    // AUTO-SUGGEST ENGINE
    if (mode === 'auto_suggest') {
      const ingredients = await prisma.ingredient.findMany({
        where: { brandId: activeBrandId },
        include: {
          suppliers: {
            include: {
              supplier: true,
            },
            orderBy: [{ isPreferred: 'desc' }, { negotiatedCost: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      });

      // Filter ingredients that breached reorder point
      const suggestions = ingredients
        .filter((ing) => {
          const effectiveReorderPoint = ing.reorderPoint !== null && ing.reorderPoint !== undefined 
            ? ing.reorderPoint 
            : (ing.minStock > 0 ? ing.minStock : 5);
          return ing.stock <= effectiveReorderPoint;
        })
        .map((ing) => {
          const targetPar = ing.parLevel !== null && ing.parLevel !== undefined && ing.parLevel > 0 
            ? ing.parLevel 
            : Math.max((ing.minStock * 2), 10);
          const rawDeficit = targetPar - ing.stock;
          const preferredSupplierRel = ing.suppliers.find((s) => s.isPreferred) || ing.suppliers[0];
          const minQty = preferredSupplierRel?.minOrderQty || 1;
          const suggestedQty = Math.max(minQty, Math.ceil(rawDeficit * 10) / 10);
          const unitCost = preferredSupplierRel ? preferredSupplierRel.negotiatedCost : ing.cost;
          const totalEstimated = suggestedQty * unitCost;

          return {
            ingredientId: ing.id,
            ingredientName: ing.name,
            unit: ing.unit,
            currentStock: ing.stock,
            minStock: ing.minStock,
            reorderPoint: ing.reorderPoint ?? (ing.minStock || 5),
            parLevel: targetPar,
            suggestedQty,
            preferredSupplier: preferredSupplierRel ? {
              id: preferredSupplierRel.supplier.id,
              name: preferredSupplierRel.supplier.name,
              negotiatedCost: preferredSupplierRel.negotiatedCost,
              supplierSku: preferredSupplierRel.supplierSku,
              leadTimeDays: preferredSupplierRel.supplier.leadTimeDays,
              paymentTerms: preferredSupplierRel.supplier.paymentTerms,
            } : null,
            availableSuppliers: ing.suppliers.map((s) => ({
              id: s.supplier.id,
              name: s.supplier.name,
              negotiatedCost: s.negotiatedCost,
              isPreferred: s.isPreferred,
            })),
            estimatedUnitCost: unitCost,
            estimatedTotal: totalEstimated,
          };
        });

      return NextResponse.json({ suggestions });
    }

    // REGULAR LIST OF PURCHASE ORDERS
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    const whereClause: Record<string, unknown> = {
      brandId: activeBrandId,
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (supplierId && supplierId !== 'ALL') {
      whereClause.supplierId = supplierId;
    }

    if (search) {
      whereClause.OR = [
        { folio: { contains: search } },
        { invoiceRef: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        receivedBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ purchaseOrders });
  } catch (error: unknown) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
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
    const { action } = body;

    // HELPER: Generate next consecutive folio (e.g. "OC-0001")
    const getNextFolio = async () => {
      const lastPO = await prisma.purchaseOrder.findFirst({
        where: { brandId: activeBrandId },
        orderBy: { createdAt: 'desc' },
        select: { folio: true },
      });

      let nextNum = 1;
      if (lastPO && lastPO.folio) {
        const match = lastPO.folio.match(/OC-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      return `OC-${String(nextNum).padStart(4, '0')}`;
    };

    // ACTION: AUTO-GENERATE POs FROM SUGGESTIONS GROUPED BY SUPPLIER
    if (action === 'generate_auto_pos') {
      const { selectedSuggestions, expectedDate } = body;
      if (!Array.isArray(selectedSuggestions) || selectedSuggestions.length === 0) {
        return NextResponse.json({ error: 'No se seleccionaron insumos para reabastecimiento' }, { status: 400 });
      }

      // Group suggestions by supplierId
      const groups = new Map<string, Array<{ ingredientId: string; quantity: number; unitCost: number }>>();

      for (const item of selectedSuggestions) {
        if (!item.supplierId) continue;
        if (!groups.has(item.supplierId)) {
          groups.set(item.supplierId, []);
        }
        groups.get(item.supplierId)!.push({
          ingredientId: item.ingredientId,
          quantity: parseFloat(item.quantity) || 1,
          unitCost: parseFloat(item.unitCost) || 0,
        });
      }

      if (groups.size === 0) {
        return NextResponse.json({ error: 'Ningún insumo seleccionado tiene un proveedor asignado' }, { status: 400 });
      }

      const createdPOs = [];

      for (const [supplierId, items] of groups.entries()) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
        });

        const folio = await getNextFolio();
        const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.unitCost), 0);
        const taxRate = 0.16; // Default standard IVA, can be 0 or customized
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;

        const po = await prisma.purchaseOrder.create({
          data: {
            folio,
            brandId: activeBrandId,
            supplierId,
            createdById: session.userId,
            status: 'ORDERED',
            paymentTerms: supplier?.paymentTerms || 'CONTADO',
            expectedDate: expectedDate ? new Date(expectedDate) : (
              supplier?.leadTimeDays 
                ? new Date(Date.now() + supplier.leadTimeDays * 86400000) 
                : new Date(Date.now() + 86400000)
            ),
            subtotal,
            taxRate,
            taxAmount,
            total,
            notes: 'Generada automáticamente por cálculo de Punto de Reorden (Auto-PO)',
            items: {
              create: items.map((it) => ({
                ingredientId: it.ingredientId,
                quantityOrdered: it.quantity,
                unitCost: it.unitCost,
                totalCost: it.quantity * it.unitCost,
              })),
            },
          },
          include: {
            supplier: true,
            items: {
              include: { ingredient: true },
            },
          },
        });

        await recordAuditLog({
          action: 'PURCHASE_ORDER_AUTOGENERATED',
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          details: { folio: po.folio, supplierName: supplier?.name, total, itemsCount: items.length },
          severity: 'INFO',
          brandId: activeBrandId,
          userId: session.userId,
          req,
        });

        createdPOs.push(po);
      }

      return NextResponse.json({
        success: true,
        message: `Se crearon ${createdPOs.length} órdenes de compra automáticas`,
        purchaseOrders: createdPOs,
      });
    }

    // ACTION: MANUAL PURCHASE ORDER CREATION
    const {
      supplierId,
      expectedDate,
      paymentTerms,
      taxRate = 0,
      notes,
      items, // Array of { ingredientId, quantityOrdered, unitCost, notes }
    } = body;

    if (!supplierId) {
      return NextResponse.json({ error: 'El proveedor es obligatorio' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La orden debe contener al menos un insumo' }, { status: 400 });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, brandId: activeBrandId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const folio = await getNextFolio();

    const calculatedItems = items.map((it) => {
      const q = parseFloat(it.quantityOrdered) || 0;
      const c = parseFloat(it.unitCost) || 0;
      return {
        ingredientId: it.ingredientId,
        quantityOrdered: q,
        unitCost: c,
        totalCost: q * c,
        notes: it.notes ? String(it.notes).trim() : null,
      };
    });

    const subtotal = calculatedItems.reduce((acc, curr) => acc + curr.totalCost, 0);
    const parsedTaxRate = parseFloat(taxRate) || 0;
    const taxAmount = subtotal * parsedTaxRate;
    const total = subtotal + taxAmount;

    const newPO = await prisma.purchaseOrder.create({
      data: {
        folio,
        brandId: activeBrandId,
        supplierId,
        createdById: session.userId,
        status: 'ORDERED',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        paymentTerms: paymentTerms || supplier.paymentTerms || 'CONTADO',
        subtotal,
        taxRate: parsedTaxRate,
        taxAmount,
        total,
        notes: notes ? notes.trim() : null,
        items: {
          create: calculatedItems,
        },
      },
      include: {
        supplier: true,
        items: {
          include: { ingredient: true },
        },
      },
    });

    await recordAuditLog({
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'PURCHASE_ORDER',
      entityId: newPO.id,
      details: { folio: newPO.folio, supplier: supplier.name, total, itemsCount: calculatedItems.length },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, purchaseOrder: newPO });
  } catch (error: unknown) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Error al procesar orden de compra' }, { status: 500 });
  }
}
