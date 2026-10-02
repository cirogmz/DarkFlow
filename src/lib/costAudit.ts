import { prisma } from '@/lib/db';

export interface TheoreticalIngredientConsumption {
  ingredientId: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  theoreticalQty: number;
  theoreticalCost: number;
  purchasedQty: number;
  purchasedCost: number;
  averagePurchaseCost: number; // PPP (Precio Promedio Ponderado)
  costVariancePct: number;      // Variación entre Costo Estándar y PPP
  registeredWasteQty: number;
  registeredWasteCost: number;
  discrepancyQty: number;       // Diferencia de inventario físico más reciente si existe
  discrepancyCost: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

export interface MenuEngineeringItem {
  productId: string;
  name: string;
  price: number;
  recipeCost: number;
  margin: number;
  marginPct: number;
  unitsSold: number;
  totalRevenue: number;
  totalProfit: number;
  popularitySharePct: number;
  classification: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';
  recommendation: string;
}

export interface FoodCostReport {
  period: {
    startDate?: string;
    endDate?: string;
    rangeLabel: string;
  };
  financialSummary: {
    totalNetSales: number;
    totalOrdersCount: number;
    theoreticalFoodCost: number;
    theoreticalFoodCostPct: number;
    registeredWasteCost: number;
    unregisteredDiscrepancyCost: number;
    realFoodCost: number;
    realFoodCostPct: number;
    targetFoodCostPct: number; // Generalmente 30%
    variancePctPoints: number; // realFoodCostPct - theoreticalFoodCostPct
    health: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
    healthBadge: string;
  };
  topDiscrepancies: TheoreticalIngredientConsumption[];
  ingredientsConsumption: TheoreticalIngredientConsumption[];
  menuEngineering: {
    averageMargin: number;
    averageUnitsSold: number;
    items: MenuEngineeringItem[];
    starsCount: number;
    plowhorsesCount: number;
    puzzlesCount: number;
    dogsCount: number;
  };
}

/**
 * Genera el análisis de Auditoría de Costos, Receta Teórica vs Consumo Real
 * y Clasificación de Rentabilidad (Ingeniería de Menú)
 */
export async function getFoodCostAnalysis(
  brandId: string,
  startDate?: Date,
  endDate?: Date
): Promise<FoodCostReport> {
  const whereOrders: any = {
    brandId,
    status: { notIn: ['CANCELLED', 'REJECTED'] },
  };

  if (startDate || endDate) {
    whereOrders.createdAt = {};
    if (startDate) whereOrders.createdAt.gte = startDate;
    if (endDate) whereOrders.createdAt.lte = endDate;
  }

  // 1. Obtener órdenes con ítems de comanda
  const orders = await prisma.order.findMany({
    where: whereOrders,
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeItems: {
                include: {
                  ingredient: {
                    include: {
                      parentSubRecipes: {
                        include: {
                          childIngredient: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // 2. Obtener todos los ingredientes de la marca
  const ingredients = await prisma.ingredient.findMany({
    where: { brandId },
    include: {
      parentSubRecipes: {
        include: { childIngredient: true },
      },
    },
  });

  // 3. Obtener compras en el período
  const wherePurchases: any = { brandId };
  if (startDate || endDate) {
    wherePurchases.purchaseDate = {};
    if (startDate) wherePurchases.purchaseDate.gte = startDate;
    if (endDate) wherePurchases.purchaseDate.lte = endDate;
  }
  const purchases = await prisma.purchase.findMany({
    where: wherePurchases,
  });

  // 4. Obtener mermas registradas en el período
  const whereWaste: any = { brandId };
  if (startDate || endDate) {
    whereWaste.createdAt = {};
    if (startDate) whereWaste.createdAt.gte = startDate;
    if (endDate) whereWaste.createdAt.lte = endDate;
  }
  const wasteLogs = await prisma.wasteLog.findMany({
    where: whereWaste,
  });

  // 5. Obtener ítems de auditoría de inventario físico más recientes
  const recentAudits = await prisma.inventoryAudit.findMany({
    where: {
      brandId,
      status: { in: ['COMPLETED', 'APPLIED'] },
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Mapas auxiliares para agregaciones
  const theoreticalQtyMap = new Map<string, number>();
  const productSalesMap = new Map<
    string,
    { product: any; unitsSold: number; totalRevenue: number }
  >();

  let totalNetSales = 0;
  let totalOrdersCount = orders.length;

  for (const order of orders) {
    totalNetSales += order.subtotal || (order.total - (order.tip || 0));

    for (const item of order.items) {
      if (!item.product) continue;
      const pid = item.productId;
      const currentProd = productSalesMap.get(pid) || {
        product: item.product,
        unitsSold: 0,
        totalRevenue: 0,
      };
      currentProd.unitsSold += item.quantity;
      currentProd.totalRevenue += item.quantity * item.price;
      productSalesMap.set(pid, currentProd);

      // Desglose de Ficha Técnica (Receta)
      if (item.product.recipeItems) {
        for (const recipeItem of item.product.recipeItems) {
          const ingId = recipeItem.ingredientId;
          const consumed = recipeItem.quantity * item.quantity;

          // Si el ingrediente es una sub-receta compuesta (ej: Salsa Boloñesa)
          if (
            recipeItem.ingredient.parentSubRecipes &&
            recipeItem.ingredient.parentSubRecipes.length > 0
          ) {
            for (const subItem of recipeItem.ingredient.parentSubRecipes) {
              const childId = subItem.childIngredientId;
              const subConsumed = subItem.quantity * consumed;
              theoreticalQtyMap.set(
                childId,
                (theoreticalQtyMap.get(childId) || 0) + subConsumed
              );
            }
          } else {
            theoreticalQtyMap.set(
              ingId,
              (theoreticalQtyMap.get(ingId) || 0) + consumed
            );
          }
        }
      }
    }
  }

  // Agregación de compras (Cálculo de PPP)
  const purchaseStatsMap = new Map<
    string,
    { totalQty: number; totalCost: number }
  >();
  for (const p of purchases) {
    const cur = purchaseStatsMap.get(p.ingredientId) || {
      totalQty: 0,
      totalCost: 0,
    };
    cur.totalQty += p.quantity;
    cur.totalCost += p.quantity * p.cost;
    purchaseStatsMap.set(p.ingredientId, cur);
  }

  // Agregación de mermas registradas
  const wasteStatsMap = new Map<
    string,
    { totalQty: number; totalCost: number }
  >();
  for (const w of wasteLogs) {
    const cur = wasteStatsMap.get(w.ingredientId) || {
      totalQty: 0,
      totalCost: 0,
    };
    cur.totalQty += w.quantity;
    cur.totalCost += w.totalCost;
    wasteStatsMap.set(w.ingredientId, cur);
  }

  // Agregación de discrepancias de inventario físico
  const discrepancyStatsMap = new Map<
    string,
    { discrepancyQty: number; discrepancyCost: number }
  >();
  for (const audit of recentAudits) {
    for (const aItem of audit.items) {
      if (!discrepancyStatsMap.has(aItem.ingredientId)) {
        discrepancyStatsMap.set(aItem.ingredientId, {
          discrepancyQty: aItem.discrepancy,
          discrepancyCost: aItem.discrepancyCost,
        });
      }
    }
  }

  // Construir lista detallada de insumos
  let totalTheoreticalFoodCost = 0;
  let totalRegisteredWasteCost = 0;
  let totalUnregisteredDiscrepancyCost = 0;

  const ingredientsConsumption: TheoreticalIngredientConsumption[] = ingredients.map(
    (ing: any) => {
      const theoQty = theoreticalQtyMap.get(ing.id) || 0;
      const theoCost = theoQty * ing.cost;
      totalTheoreticalFoodCost += theoCost;

      const pStat = purchaseStatsMap.get(ing.id) || { totalQty: 0, totalCost: 0 };
      const avgPurchaseCost =
        pStat.totalQty > 0 ? pStat.totalCost / pStat.totalQty : ing.cost;

      const costVariancePct =
        ing.cost > 0
          ? ((avgPurchaseCost - ing.cost) / ing.cost) * 100
          : 0;

      const wStat = wasteStatsMap.get(ing.id) || { totalQty: 0, totalCost: 0 };
      totalRegisteredWasteCost += wStat.totalCost;

      const dStat = discrepancyStatsMap.get(ing.id) || {
        discrepancyQty: 0,
        discrepancyCost: 0,
      };
      if (dStat.discrepancyCost < 0) {
        totalUnregisteredDiscrepancyCost += Math.abs(dStat.discrepancyCost);
      }

      // Evaluar status de alarma
      let status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' = 'OPTIMAL';
      if (ing.stock <= ing.minStock || dStat.discrepancyQty < -5) {
        status = 'CRITICAL';
      } else if (costVariancePct > 15 || dStat.discrepancyQty < 0) {
        status = 'WARNING';
      }

      return {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        currentStock: Number(ing.stock.toFixed(2)),
        minStock: Number(ing.minStock.toFixed(2)),
        unitCost: Number(ing.cost.toFixed(2)),
        theoreticalQty: Number(theoQty.toFixed(2)),
        theoreticalCost: Number(theoCost.toFixed(2)),
        purchasedQty: Number(pStat.totalQty.toFixed(2)),
        purchasedCost: Number(pStat.totalCost.toFixed(2)),
        averagePurchaseCost: Number(avgPurchaseCost.toFixed(2)),
        costVariancePct: Number(costVariancePct.toFixed(1)),
        registeredWasteQty: Number(wStat.totalQty.toFixed(2)),
        registeredWasteCost: Number(wStat.totalCost.toFixed(2)),
        discrepancyQty: Number(dStat.discrepancyQty.toFixed(2)),
        discrepancyCost: Number(dStat.discrepancyCost.toFixed(2)),
        status,
      };
    }
  );

  // Ordenar insumos por costo teórico consumido desc
  ingredientsConsumption.sort((a, b) => b.theoreticalCost - a.theoreticalCost);

  // Insumos con mayores pérdidas o descuadres (fugas)
  const topDiscrepancies = [...ingredientsConsumption]
    .filter((i) => i.discrepancyCost < 0 || i.registeredWasteCost > 0)
    .sort(
      (a, b) =>
        a.discrepancyCost - b.discrepancyCost ||
        b.registeredWasteCost - a.registeredWasteCost
    )
    .slice(0, 5);

  // 6. Matriz de Ingeniería de Menú (BCG Gastronómica)
  // Obtener todos los productos para evaluar su receta
  const allProducts = await prisma.product.findMany({
    where: { category: { brandId }, isActive: true },
    include: {
      recipeItems: {
        include: {
          ingredient: true,
        },
      },
    },
  });

  const menuItems: MenuEngineeringItem[] = [];
  let sumMargin = 0;
  let sumUnits = 0;
  let totalAllSoldUnits = 0;

  for (const prod of allProducts) {
    const saleData = productSalesMap.get(prod.id) || {
      product: prod,
      unitsSold: 0,
      totalRevenue: 0,
    };
    totalAllSoldUnits += saleData.unitsSold;

    // Calcular costo unitario de receta
    let recipeCost = 0;
    for (const rItem of prod.recipeItems) {
      recipeCost += (rItem.ingredient.cost || 0) * rItem.quantity;
    }

    const margin = prod.price - recipeCost;
    const marginPct = prod.price > 0 ? (margin / prod.price) * 100 : 0;

    sumMargin += margin;
    sumUnits += saleData.unitsSold;

    menuItems.push({
      productId: prod.id,
      name: prod.name,
      price: Number(prod.price.toFixed(2)),
      recipeCost: Number(recipeCost.toFixed(2)),
      margin: Number(margin.toFixed(2)),
      marginPct: Number(marginPct.toFixed(1)),
      unitsSold: saleData.unitsSold,
      totalRevenue: Number(saleData.totalRevenue.toFixed(2)),
      totalProfit: Number((saleData.unitsSold * margin).toFixed(2)),
      popularitySharePct: 0, // Se calcula después
      classification: 'DOG', // Se calcula con promedios
      recommendation: '',
    });
  }

  const averageMargin =
    menuItems.length > 0 ? sumMargin / menuItems.length : 0;
  const averageUnitsSold =
    menuItems.length > 0 ? sumUnits / menuItems.length : 0;

  let starsCount = 0;
  let plowhorsesCount = 0;
  let puzzlesCount = 0;
  let dogsCount = 0;

  for (const item of menuItems) {
    item.popularitySharePct =
      totalAllSoldUnits > 0
        ? Number(((item.unitsSold / totalAllSoldUnits) * 100).toFixed(1))
        : 0;

    const isHighPopularity = item.unitsSold >= averageUnitsSold;
    const isHighProfitability = item.margin >= averageMargin;

    if (isHighPopularity && isHighProfitability) {
      item.classification = 'STAR';
      item.recommendation =
        'Mantener receta y presentación intacta; destacar en portadas y promociones.';
      starsCount++;
    } else if (isHighPopularity && !isHighProfitability) {
      item.classification = 'PLOWHORSE';
      item.recommendation =
        'Optimizar gramaje de insumos o incrementar ligeramente el precio de venta.';
      plowhorsesCount++;
    } else if (!isHighPopularity && isHighProfitability) {
      item.classification = 'PUZZLE';
      item.recommendation =
        'Impulsar con meseros, mejorar fotos del menú y evaluar combo atractivo.';
      puzzlesCount++;
    } else {
      item.classification = 'DOG';
      item.recommendation =
        'Evaluar reemplazo, reformular receta o eliminar si el inventario genera merma.';
      dogsCount++;
    }
  }

  // Ordenar menú items por beneficio total desc
  menuItems.sort((a, b) => b.totalProfit - a.totalProfit);

  // 7. Cálculos de Food Cost General
  const realFoodCost =
    totalTheoreticalFoodCost +
    totalRegisteredWasteCost +
    totalUnregisteredDiscrepancyCost;

  const theoreticalFoodCostPct =
    totalNetSales > 0 ? (totalTheoreticalFoodCost / totalNetSales) * 100 : 0;

  const realFoodCostPct =
    totalNetSales > 0 ? (realFoodCost / totalNetSales) * 100 : 0;

  const variancePctPoints = realFoodCostPct - theoreticalFoodCostPct;

  let health: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL' = 'GOOD';
  let healthBadge = 'Saludable';

  if (realFoodCostPct < 30) {
    health = 'EXCELLENT';
    healthBadge = 'Excelente Rendimiento';
  } else if (realFoodCostPct <= 34) {
    health = 'GOOD';
    healthBadge = 'Saludable (Dentro de Benchmark)';
  } else if (realFoodCostPct <= 38) {
    health = 'WARNING';
    healthBadge = 'Atención Requerida (Costo Elevado)';
  } else {
    health = 'CRITICAL';
    healthBadge = 'Alerta Crítica (Fuga de Rentabilidad)';
  }

  let rangeLabel = 'Histórico Global';
  if (startDate && endDate) {
    rangeLabel = `${startDate.toLocaleDateString('es-MX')} al ${endDate.toLocaleDateString('es-MX')}`;
  } else if (startDate) {
    rangeLabel = `Desde ${startDate.toLocaleDateString('es-MX')}`;
  }

  return {
    period: {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      rangeLabel,
    },
    financialSummary: {
      totalNetSales: Number(totalNetSales.toFixed(2)),
      totalOrdersCount,
      theoreticalFoodCost: Number(totalTheoreticalFoodCost.toFixed(2)),
      theoreticalFoodCostPct: Number(theoreticalFoodCostPct.toFixed(1)),
      registeredWasteCost: Number(totalRegisteredWasteCost.toFixed(2)),
      unregisteredDiscrepancyCost: Number(
        totalUnregisteredDiscrepancyCost.toFixed(2)
      ),
      realFoodCost: Number(realFoodCost.toFixed(2)),
      realFoodCostPct: Number(realFoodCostPct.toFixed(1)),
      targetFoodCostPct: 30.0,
      variancePctPoints: Number(variancePctPoints.toFixed(1)),
      health,
      healthBadge,
    },
    topDiscrepancies,
    ingredientsConsumption,
    menuEngineering: {
      averageMargin: Number(averageMargin.toFixed(2)),
      averageUnitsSold: Number(averageUnitsSold.toFixed(1)),
      items: menuItems,
      starsCount,
      plowhorsesCount,
      puzzlesCount,
      dogsCount,
    },
  };
}

/**
 * Genera el siguiente folio consecutivo para auditoría de inventario físico (AUD-0001)
 */
export async function generateAuditFolio(brandId: string): Promise<string> {
  const count = await prisma.inventoryAudit.count({
    where: { brandId },
  });
  const nextNum = count + 1;
  return `AUD-${String(nextNum).padStart(4, '0')}`;
}
