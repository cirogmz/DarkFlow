import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HistoricalWeekSales {
  weekIndex: number; // 1 = 1 week ago, 2 = 2 weeks ago, etc.
  dateString: string;
  weight: number;
  unitsSold: number;
}

interface ProductForecastItem {
  productId: string;
  productName: string;
  kitchenStation: string;
  historicalWeeks: HistoricalWeekSales[];
  projectedUnits: number;
  roundedUnits: number;
}

interface PrepItemSuggestion {
  ingredientId: string;
  itemName: string;
  itemType: 'SUB_RECIPE' | 'INGREDIENT';
  station: string;
  unit: string;
  currentStock: number;
  minStock: number;
  projectedDemand: number;
  safetyBufferQty: number;
  grossTargetNeed: number;
  suggestedPrepQty: number;
  urgency: 'CRITICAL' | 'LOW_STOCK' | 'SUFFICIENT';
  isSubRecipe: boolean;
  yieldQuantity: number;
  yieldUnit: string;
  usedInProducts: Array<{
    productId: string;
    productName: string;
    qtyPerPortion: number;
    projectedDemand: number;
  }>;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);

    // Target date parameter (default to today or specified date YYYY-MM-DD)
    const dateParam = searchParams.get('date');
    const shiftParam = (searchParams.get('shift') || 'ALL_DAY').toUpperCase(); // ALL_DAY, LUNCH, DINNER
    const lookbackWeeks = Math.max(1, Math.min(8, parseInt(searchParams.get('lookbackWeeks') || '4', 10)));
    const bufferPct = Math.max(0, Math.min(50, parseFloat(searchParams.get('bufferPct') || '15'))); // 15% safety buffer

    // Parse target date
    const targetDate = dateParam ? new Date(`${dateParam}T12:00:00Z`) : new Date();
    const dayOfWeek = targetDate.getUTCDay();
    const dayOfWeekName = DAY_NAMES[dayOfWeek];

    // Compute weights for WMA (linearly decaying: weight_k = (N - k + 1) / sum(1..N))
    const sumWeights = (lookbackWeeks * (lookbackWeeks + 1)) / 2;
    const weights: number[] = [];
    for (let k = 1; k <= lookbackWeeks; k++) {
      weights.push((lookbackWeeks - k + 1) / sumWeights);
    }

    // Determine date intervals for past N weeks on the same day-of-week
    interface HistoricalRange {
      weekIndex: number;
      startDate: Date;
      endDate: Date;
      dateString: string;
      weight: number;
    }

    const historicalRanges: HistoricalRange[] = [];
    for (let k = 1; k <= lookbackWeeks; k++) {
      const pastDate = new Date(targetDate);
      pastDate.setUTCDate(targetDate.getUTCDate() - 7 * k);

      // Start of day
      const start = new Date(pastDate);
      start.setUTCHours(0, 0, 0, 0);

      // End of day
      const end = new Date(pastDate);
      end.setUTCHours(23, 59, 59, 999);

      // Adjust for shift if requested
      if (shiftParam === 'LUNCH') {
        start.setUTCHours(11, 0, 0, 0);
        end.setUTCHours(16, 59, 59, 999);
      } else if (shiftParam === 'DINNER') {
        start.setUTCHours(17, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);
      }

      historicalRanges.push({
        weekIndex: k,
        startDate: start,
        endDate: end,
        dateString: pastDate.toISOString().split('T')[0],
        weight: weights[k - 1],
      });
    }

    // Earliest start date and latest end date for historical query
    const earliestDate = historicalRanges[historicalRanges.length - 1].startDate;
    const latestDate = historicalRanges[0].endDate;

    // Fetch active products with recipes and sub-recipe tree
    const products = await prisma.product.findMany({
      where: { brandId: activeBrandId, isActive: true },
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
    });

    // Also fetch all prepared ingredients (sub-recipes) for the brand
    const allIngredients = await prisma.ingredient.findMany({
      where: { brandId: activeBrandId },
      include: {
        parentSubRecipes: {
          include: {
            childIngredient: true,
          },
        },
      },
    });

    // Fetch historical order items in the date range
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          brandId: activeBrandId,
          createdAt: {
            gte: earliestDate,
            lte: latestDate,
          },
          status: { in: ['DELIVERED', 'COMPLETED', 'READY', 'PREPARING'] },
        },
      },
      select: {
        productId: true,
        quantity: true,
        order: {
          select: {
            createdAt: true,
          },
        },
      },
    });

    // Bucket sales by product and historical range
    const productSalesMap = new Map<string, number[]>();
    for (const prod of products) {
      productSalesMap.set(prod.id, new Array(lookbackWeeks).fill(0));
    }

    for (const item of orderItems) {
      if (!productSalesMap.has(item.productId)) continue;

      const orderTime = new Date(item.order.createdAt).getTime();
      const currentSales = productSalesMap.get(item.productId)!;

      for (let i = 0; i < historicalRanges.length; i++) {
        const range = historicalRanges[i];
        if (orderTime >= range.startDate.getTime() && orderTime <= range.endDate.getTime()) {
          currentSales[i] += item.quantity;
          break;
        }
      }
    }

    // Calculate product forecast using WMA
    const productsForecast: ProductForecastItem[] = [];
    const productProjectedUnitsMap = new Map<string, number>();

    let totalProjectedDishes = 0;

    for (const prod of products) {
      const salesHistory = productSalesMap.get(prod.id) || new Array(lookbackWeeks).fill(0);
      let projected = 0;
      const historyBreakdown: HistoricalWeekSales[] = [];

      for (let i = 0; i < lookbackWeeks; i++) {
        const units = salesHistory[i];
        const weight = historicalRanges[i].weight;
        projected += units * weight;
        historyBreakdown.push({
          weekIndex: i + 1,
          dateString: historicalRanges[i].dateString,
          weight: Math.round(weight * 100) / 100,
          unitsSold: units,
        });
      }

      const roundedUnits = Math.round(projected);
      productProjectedUnitsMap.set(prod.id, projected);
      totalProjectedDishes += projected;

      productsForecast.push({
        productId: prod.id,
        productName: prod.name,
        kitchenStation: prod.kitchenStation || 'COCINA',
        historicalWeeks: historyBreakdown,
        projectedUnits: Math.round(projected * 10) / 10,
        roundedUnits,
      });
    }

    // Sort products by projected units desc
    productsForecast.sort((a, b) => b.projectedUnits - a.projectedUnits);

    // ==============================================================
    // Explosión de Recetas a Insumos Preparados y Materias Primas
    // ==============================================================
    const prepAggregationMap = new Map<
      string,
      {
        ingredient: typeof allIngredients[0];
        projectedDemand: number;
        primaryStation: string;
        usedIn: Array<{
          productId: string;
          productName: string;
          qtyPerPortion: number;
          projectedDemand: number;
        }>;
      }
    >();

    for (const prod of products) {
      const projectedUnits = productProjectedUnitsMap.get(prod.id) || 0;
      if (projectedUnits <= 0) continue;

      for (const recipeItem of prod.recipeItems) {
        const ing = recipeItem.ingredient;
        const qtyNeeded = projectedUnits * recipeItem.quantity;

        if (!prepAggregationMap.has(ing.id)) {
          prepAggregationMap.set(ing.id, {
            ingredient: ing,
            projectedDemand: 0,
            primaryStation: prod.kitchenStation || 'COCINA',
            usedIn: [],
          });
        }

        const agg = prepAggregationMap.get(ing.id)!;
        agg.projectedDemand += qtyNeeded;
        agg.usedIn.push({
          productId: prod.id,
          productName: prod.name,
          qtyPerPortion: recipeItem.quantity,
          projectedDemand: Math.round(qtyNeeded * 100) / 100,
        });
      }
    }

    // Also include any PREPARED ingredients for this brand that might not have orders yet, but exist
    for (const ing of allIngredients) {
      if (ing.type === 'PREPARED' && !prepAggregationMap.has(ing.id)) {
        prepAggregationMap.set(ing.id, {
          ingredient: ing,
          projectedDemand: 0,
          primaryStation: 'COCINA',
          usedIn: [],
        });
      }
    }

    // Build suggested prep items list
    const prepItems: PrepItemSuggestion[] = [];

    prepAggregationMap.forEach((agg) => {
      const ing = agg.ingredient;
      const isSubRecipe = ing.type === 'PREPARED' || (ing.parentSubRecipes && ing.parentSubRecipes.length > 0);
      const currentStock = ing.stock;
      const minStock = ing.minStock || 0;
      const projectedDemand = Math.round(agg.projectedDemand * 100) / 100;

      // Safety buffer application
      const safetyBufferQty = Math.round((projectedDemand * bufferPct) / 100 * 100) / 100;
      const grossTargetNeed = Math.round((projectedDemand + safetyBufferQty) * 100) / 100;

      // Net Prep needed: max(0, grossTargetNeed - currentStock)
      const suggestedPrepQty = Math.max(0, Math.round((grossTargetNeed - currentStock) * 100) / 100);

      // Determine urgency
      let urgency: 'CRITICAL' | 'LOW_STOCK' | 'SUFFICIENT' = 'SUFFICIENT';
      if (grossTargetNeed > 0 && currentStock <= 0) {
        urgency = 'CRITICAL';
      } else if (currentStock < grossTargetNeed) {
        urgency = 'LOW_STOCK';
      }

      if (isSubRecipe || grossTargetNeed > 0 || currentStock < minStock) {
        prepItems.push({
          ingredientId: ing.id,
          itemName: ing.name,
          itemType: isSubRecipe ? 'SUB_RECIPE' : 'INGREDIENT',
          station: agg.primaryStation,
          unit: ing.unit,
          currentStock,
          minStock,
          projectedDemand,
          safetyBufferQty,
          grossTargetNeed,
          suggestedPrepQty,
          urgency,
          isSubRecipe,
          yieldQuantity: ing.yieldQuantity || 1,
          yieldUnit: ing.yieldUnit || ing.unit,
          usedInProducts: agg.usedIn,
        });
      }
    });

    const urgencyWeight = { CRITICAL: 3, LOW_STOCK: 2, SUFFICIENT: 1 };
    prepItems.sort((a, b) => {
      if (urgencyWeight[b.urgency] !== urgencyWeight[a.urgency]) {
        return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      }
      if (a.isSubRecipe !== b.isSubRecipe) {
        return a.isSubRecipe ? -1 : 1;
      }
      return b.suggestedPrepQty - a.suggestedPrepQty;
    });

    const stationMap: Record<string, { totalItems: number; pendingPrepCount: number; criticalCount: number }> = {};
    for (const item of prepItems) {
      if (!stationMap[item.station]) {
        stationMap[item.station] = { totalItems: 0, pendingPrepCount: 0, criticalCount: 0 };
      }
      stationMap[item.station].totalItems += 1;
      if (item.suggestedPrepQty > 0) {
        stationMap[item.station].pendingPrepCount += 1;
      }
      if (item.urgency === 'CRITICAL') {
        stationMap[item.station].criticalCount += 1;
      }
    }

    return NextResponse.json({
      summary: {
        targetDate: targetDate.toISOString().split('T')[0],
        dayOfWeek,
        dayOfWeekName,
        shift: shiftParam,
        lookbackWeeks,
        bufferPct,
        totalProjectedDishes: Math.round(totalProjectedDishes),
        totalPrepItems: prepItems.length,
        criticalItemsCount: prepItems.filter((i) => i.urgency === 'CRITICAL').length,
        lowStockItemsCount: prepItems.filter((i) => i.urgency === 'LOW_STOCK').length,
        itemsRequiringPrepCount: prepItems.filter((i) => i.suggestedPrepQty > 0).length,
      },
      historicalRanges: historicalRanges.map((r) => ({
        weekIndex: r.weekIndex,
        dateString: r.dateString,
        weight: Math.round(r.weight * 100) / 100,
      })),
      productsForecast,
      prepItems,
      stationBreakdown: stationMap,
    });
  } catch (error: unknown) {
    console.error('Error in /api/kitchen/forecast:', error);
    return NextResponse.json({ error: 'Error al calcular pronóstico de cocina' }, { status: 500 });
  }
}
