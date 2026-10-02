import { prisma } from '@/lib/db';

export interface CreateRequisitionItemDTO {
  ingredientId: string;
  requestedQty: number;
  notes?: string;
}

export interface CreateRequisitionDTO {
  type?: 'WAREHOUSE_TRANSFER' | 'PURCHASE_REQUEST';
  urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  fromWarehouseId?: string;
  toWarehouseId?: string;
  notes?: string;
  items: CreateRequisitionItemDTO[];
}

/**
 * Genera el siguiente folio consecutivo para requisiciones internas (REQ-0001)
 */
export async function generateRequisitionFolio(brandId: string): Promise<string> {
  const count = await prisma.internalRequisition.count({
    where: { brandId },
  });
  return `REQ-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Genera el siguiente folio de guía de despacho / remisión (GUIA-0001)
 */
export async function generateDispatchGuideNumber(brandId: string): Promise<string> {
  const count = await prisma.internalRequisition.count({
    where: { brandId, dispatchGuide: { not: null } },
  });
  return `GUIA-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Crea una nueva requisición interna con desglose de insumos
 */
export async function createInternalRequisition(
  brandId: string,
  userId: string,
  dto: CreateRequisitionDTO
) {
  const { type = 'WAREHOUSE_TRANSFER', urgency = 'NORMAL', fromWarehouseId, toWarehouseId, notes, items } = dto;

  if (!items || items.length === 0) {
    throw new Error('La requisición debe incluir al menos un insumo');
  }

  // Obtener costos unitarios de los insumos solicitados
  const ingredientIds = items.map((i) => i.ingredientId);
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds }, brandId },
  });

  const ingMap = new Map(ingredients.map((ing) => [ing.id, ing]));
  let totalEstimatedCost = 0;

  const itemsData = items.map((it) => {
    const ing = ingMap.get(it.ingredientId);
    const unitCost = ing ? ing.cost : 0;
    const requestedQty = Number(it.requestedQty) || 0;
    totalEstimatedCost += requestedQty * unitCost;

    return {
      ingredientId: it.ingredientId,
      requestedQty,
      approvedQty: requestedQty, // Por defecto se propone la misma cantidad solicitada
      unitCost,
      notes: it.notes || null,
    };
  });

  const folio = await generateRequisitionFolio(brandId);

  return prisma.internalRequisition.create({
    data: {
      brandId,
      folio,
      type,
      urgency,
      status: 'SUBMITTED',
      fromWarehouseId: fromWarehouseId || null,
      toWarehouseId: toWarehouseId || null,
      requestedById: userId,
      totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
      notes: notes || null,
      items: {
        create: itemsData,
      },
    },
    include: {
      items: {
        include: {
          ingredient: { select: { id: true, name: true, unit: true, cost: true, stock: true } },
        },
      },
      fromWarehouse: true,
      toWarehouse: true,
      requestedBy: { select: { id: true, name: true, role: true } },
    },
  });
}
