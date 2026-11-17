import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

export const ML_PER_FL_OZ = 29.5735;

export type BarShiftType = 'MATUTINO' | 'VESPERTINO' | 'NOCHE' | 'TURNO_COMPLETO';

export type ShrinkageReason = 
  | 'OVER_POUR' 
  | 'SPILLAGE' 
  | 'UNRECORDED_COURTESY' 
  | 'BROKEN_BOTTLE' 
  | 'ACCURATE' 
  | 'UNDER_POUR';

export interface BarAuditItemInput {
  ingredientId: string;
  bottleLabel: string;
  bottleCapacityMl?: number;
  costPerMl?: number;
  startLevelMl: number;
  newBottlesAddedMl?: number;
  endLevelMl: number;
  measurementMethod?: 'WEIGHING' | 'TENTHS' | 'DIRECT_ML';
  measuredWeightGrams?: number;
  tareWeightGrams?: number;
  densityGramsPerMl?: number;
  measuredTenths?: number; // 0.1 a 1.0
  shrinkageReason?: ShrinkageReason;
  notes?: string;
}

export interface BarAuditReconciliationItem {
  ingredientId: string;
  ingredientName: string;
  bottleLabel: string;
  bottleCapacityMl: number;
  costPerMl: number;
  startLevelMl: number;
  newBottlesAddedMl: number;
  endLevelMl: number;
  actualPouredMl: number;
  theoreticalPouredMl: number;
  cocktailsSoldCount: number;
  varianceMl: number;
  variancePercentage: number;
  financialVariance: number;
  shrinkageReason: ShrinkageReason;
  notes?: string;
}

export interface BarAuditReconciliationResult {
  station: string;
  shift: BarShiftType;
  periodStart: Date;
  periodEnd: Date;
  totalCocktailsSold: number;
  totalTheoreticalMl: number;
  totalActualMl: number;
  varianceMl: number;
  overPourPercentage: number;
  financialLossAmount: number;
  status: 'COMPLETED' | 'DISCREPANCY_FLAGGED';
  items: BarAuditReconciliationItem[];
}

/**
 * Convierte peso en gramos de báscula a mililitros reales considerando la tara de la botella
 */
export function gramsToMl(grossWeightGrams: number, tareWeightGrams = 450, density = 0.95): number {
  const netGrams = Math.max(0, grossWeightGrams - tareWeightGrams);
  return Math.round((netGrams / density) * 10) / 10;
}

/**
 * Convierte escala visual de décimos (0.1 a 1.0) a mililitros
 */
export function tenthsToMl(tenths: number, capacityMl = 750): number {
  const clamped = Math.max(0, Math.min(1.0, tenths));
  return Math.round(clamped * capacityMl * 10) / 10;
}

/**
 * Convierte onzas líquidas (fl oz) a mililitros
 */
export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_FL_OZ * 10) / 10;
}

/**
 * Convierte mililitros a onzas líquidas
 */
export function mlToOz(ml: number): number {
  return Math.round((ml / ML_PER_FL_OZ) * 100) / 100;
}

/**
 * Calcula el consumo teórico de licor en barra analizando recetas de comandas vendidas
 */
export async function calculateTheoreticalLiquorUsage(params: {
  brandId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<Map<string, { cocktailsCount: number; theoreticalMl: number }>> {
  const { brandId, periodStart, periodEnd } = params;

  // Buscar todas las órdenes de la marca en el periodo que no estén canceladas
  const orders = await prisma.order.findMany({
    where: {
      brandId,
      status: { not: 'CANCELLED' },
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeItems: {
                include: {
                  ingredient: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const usageMap = new Map<string, { cocktailsCount: number; theoreticalMl: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const product = item.product;
      if (!product || !product.recipeItems) continue;

      const itemQty = item.quantity || 1;

      for (const recipeItem of product.recipeItems) {
        const ingredient = recipeItem.ingredient;
        if (!ingredient) continue;

        // Detectar si el insumo es medible como líquido de barra (ml, oz, l, etc.)
        const unitLower = (ingredient.unit || '').toLowerCase().trim();
        let qtyInMl = 0;

        if (unitLower === 'ml' || unitLower === 'mililitro' || unitLower === 'mililitros') {
          qtyInMl = recipeItem.quantity;
        } else if (unitLower === 'oz' || unitLower === 'onza' || unitLower === 'onzas' || unitLower === 'fl oz') {
          qtyInMl = ozToMl(recipeItem.quantity);
        } else if (unitLower === 'l' || unitLower === 'litro' || unitLower === 'litros') {
          qtyInMl = recipeItem.quantity * 1000;
        } else {
          // Asumir mL si no está especificado pero está vinculado a insumo de barra
          qtyInMl = recipeItem.quantity;
        }

        const current = usageMap.get(ingredient.id) || { cocktailsCount: 0, theoreticalMl: 0 };
        current.cocktailsCount += itemQty;
        current.theoreticalMl += Math.round(qtyInMl * itemQty * 10) / 10;
        usageMap.set(ingredient.id, current);
      }
    }
  }

  return usageMap;
}

/**
 * Compara el inventario inicial/final medido contra las ventas teóricas de coctelería
 */
export async function reconcileBarAudit(params: {
  brandId: string;
  station: string;
  shift: BarShiftType;
  periodStart: Date;
  periodEnd: Date;
  items: BarAuditItemInput[];
}): Promise<BarAuditReconciliationResult> {
  const { brandId, station, shift, periodStart, periodEnd, items } = params;

  // 1. Obtener consumos teóricos desde comandas
  const theoreticalUsage = await calculateTheoreticalLiquorUsage({
    brandId,
    periodStart,
    periodEnd,
  });

  // 2. Obtener catálogo de insumos involucrados para nombres y costos
  const ingredientIds = [...new Set(items.map((i) => i.ingredientId))];
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds } },
  });
  const ingredientsMap = new Map(ingredients.map((ing) => [ing.id, ing]));

  let totalCocktailsSold = 0;
  let totalTheoreticalMl = 0;
  let totalActualMl = 0;
  let totalFinancialLoss = 0;

  const reconciledItems: BarAuditReconciliationItem[] = [];

  for (const item of items) {
    const ingredient = ingredientsMap.get(item.ingredientId);
    const ingredientName = ingredient?.name || item.bottleLabel;
    const capacityMl = item.bottleCapacityMl || 750;

    // Costo por mL
    let costPerMl = item.costPerMl || 0;
    if (costPerMl === 0 && ingredient) {
      const unitLower = (ingredient.unit || '').toLowerCase();
      if (unitLower.includes('l')) {
        costPerMl = ingredient.cost / 1000;
      } else if (unitLower.includes('oz')) {
        costPerMl = ingredient.cost / ML_PER_FL_OZ;
      } else if (unitLower.includes('ml')) {
        costPerMl = ingredient.cost;
      } else {
        // Costo por botella dividida entre capacidad
        costPerMl = ingredient.cost / capacityMl;
      }
    }
    costPerMl = Math.round(costPerMl * 10000) / 10000;

    // Nivel final calculado según método
    let finalEndMl = item.endLevelMl;
    if (item.measurementMethod === 'WEIGHING' && typeof item.measuredWeightGrams === 'number') {
      finalEndMl = gramsToMl(item.measuredWeightGrams, item.tareWeightGrams ?? 450, item.densityGramsPerMl ?? 0.95);
    } else if (item.measurementMethod === 'TENTHS' && typeof item.measuredTenths === 'number') {
      finalEndMl = tenthsToMl(item.measuredTenths, capacityMl);
    }

    const startMl = item.startLevelMl;
    const addedMl = item.newBottlesAddedMl || 0;
    const actualPouredMl = Math.max(0, Math.round((startMl + addedMl - finalEndMl) * 10) / 10);

    // Consumo teórico de comandas
    const theo = theoreticalUsage.get(item.ingredientId) || { cocktailsCount: 0, theoreticalMl: 0 };
    const theoreticalPouredMl = Math.round(theo.theoreticalMl * 10) / 10;
    const cocktailsSoldCount = theo.cocktailsCount;

    // Varianza (mL) = Real - Teórico (positivo = fuga/sobre-vertido)
    const varianceMl = Math.round((actualPouredMl - theoreticalPouredMl) * 10) / 10;
    const variancePercentage = theoreticalPouredMl > 0
      ? Math.round(((varianceMl / theoreticalPouredMl) * 100) * 10) / 10
      : actualPouredMl > 0 ? 100 : 0;

    // Impacto financiero ($ MXN)
    const financialVariance = Math.round(varianceMl * costPerMl * 100) / 100;

    // Diagnóstico automático de causa si no fue provisto
    let reason: ShrinkageReason = item.shrinkageReason || 'ACCURATE';
    if (!item.shrinkageReason) {
      if (variancePercentage > 12) {
        reason = 'OVER_POUR';
      } else if (variancePercentage < -8) {
        reason = 'UNDER_POUR';
      } else {
        reason = 'ACCURATE';
      }
    }

    totalCocktailsSold += cocktailsSoldCount;
    totalTheoreticalMl += theoreticalPouredMl;
    totalActualMl += actualPouredMl;
    if (financialVariance > 0) {
      totalFinancialLoss += financialVariance;
    }

    reconciledItems.push({
      ingredientId: item.ingredientId,
      ingredientName,
      bottleLabel: item.bottleLabel,
      bottleCapacityMl: capacityMl,
      costPerMl,
      startLevelMl: startMl,
      newBottlesAddedMl: addedMl,
      endLevelMl: finalEndMl,
      actualPouredMl,
      theoreticalPouredMl,
      cocktailsSoldCount,
      varianceMl,
      variancePercentage,
      financialVariance,
      shrinkageReason: reason,
      notes: item.notes,
    });
  }

  const overallVarianceMl = Math.round((totalActualMl - totalTheoreticalMl) * 10) / 10;
  const overPourPercentage = totalTheoreticalMl > 0
    ? Math.round(((overallVarianceMl / totalTheoreticalMl) * 100) * 10) / 10
    : 0;

  const financialLossAmount = Math.round(totalFinancialLoss * 100) / 100;

  // Umbral de alerta de discrepancia: pérdida > $150 MXN o sobre-vertido > 8%
  const status = (financialLossAmount > 150 || overPourPercentage > 8)
    ? 'DISCREPANCY_FLAGGED'
    : 'COMPLETED';

  return {
    station,
    shift,
    periodStart,
    periodEnd,
    totalCocktailsSold,
    totalTheoreticalMl: Math.round(totalTheoreticalMl * 10) / 10,
    totalActualMl: Math.round(totalActualMl * 10) / 10,
    varianceMl: overallVarianceMl,
    overPourPercentage,
    financialLossAmount,
    status,
    items: reconciledItems,
  };
}

/**
 * Genera el comprobante térmico ESC/POS de 80mm para el cierre de barra
 */
export function generateBarAuditThermalTicket(params: {
  brandName: string;
  folio: string;
  audit: BarAuditReconciliationResult;
  auditorName: string;
}): string {
  const { brandName, folio, audit, auditorName } = params;

  let ticket = `
================================================
           AUDITORÍA Y CONTROL DE BARRA
            ${brandName.toUpperCase()}
================================================
FOLIO:         ${folio}
ESTACIÓN:      ${audit.station}
TURNO:         ${audit.shift}
CAPITÁN/AUDITOR: ${auditorName}
FECHA AUDITORÍA: ${new Date().toLocaleString('es-MX')}
PERIODO:       ${audit.periodStart.toLocaleDateString('es-MX')} a ${audit.periodEnd.toLocaleDateString('es-MX')}
ESTATUS:       ${audit.status === 'DISCREPANCY_FLAGGED' ? '⚠️ DISCREPANCIA DETECTADA' : '✅ DENTRO DE TOLERANCIA'}
------------------------------------------------
RESUMEN GENERAL DE BARRA:
• Cócteles/Tragos Vendidos:   ${audit.totalCocktailsSold} uds
• Consumo Teórico en Receta:  ${audit.totalTheoreticalMl} mL (${mlToOz(audit.totalTheoreticalMl)} oz)
• Consumo Real Medido:        ${audit.totalActualMl} mL (${mlToOz(audit.totalActualMl)} oz)
• Varianza de Licor:          ${audit.varianceMl > 0 ? '+' : ''}${audit.varianceMl} mL
• % Sobre-vertido (Over-Pour): ${audit.overPourPercentage > 0 ? '+' : ''}${audit.overPourPercentage}%
• Pérdida Financiera Merma:   $${audit.financialLossAmount.toFixed(2)} MXN
------------------------------------------------
DESGLOSE BOTELLA POR BOTELLA:
`.trim();

  ticket += '\n';

  for (const item of audit.items) {
    const diffSign = item.varianceMl > 0 ? '+' : '';
    const diagLabel = 
      item.shrinkageReason === 'OVER_POUR' ? 'SOBRE-VERTIDO' :
      item.shrinkageReason === 'SPILLAGE' ? 'DERRAME/ACCIDENTE' :
      item.shrinkageReason === 'BROKEN_BOTTLE' ? 'BOTELLA ROTA' :
      item.shrinkageReason === 'UNRECORDED_COURTESY' ? 'INVITACIÓN NO REGISTRADA' :
      item.shrinkageReason === 'UNDER_POUR' ? 'SUB-VERTIDO' : 'EXACTO';

    ticket += `
• ${item.bottleLabel}
  Teórico: ${item.theoreticalPouredMl} mL | Real: ${item.actualPouredMl} mL
  Varianza: ${diffSign}${item.varianceMl} mL (${diffSign}${item.variancePercentage}%)
  Costo Pérdida: $${item.financialVariance.toFixed(2)} MXN [${diagLabel}]
`;
  }

  ticket += `
------------------------------------------------
DICTAMEN Y RESPONSABILIDAD:
El personal de barra confirma que las mediciones
corresponden al estado físico de los licores al
cierre del turno operativo.

FIRMAS DE CONFORMIDAD:


______________________      ______________________
   Bartender en Turno          Capitán de Barra / Gerente

DarkFlow Bar & Liquor Watchdog v1.62
================================================
`.trim();

  return ticket;
}
