import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export type MenuQuadrant = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

interface DishAnalysis {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  imageUrl?: string | null;
  isActive: boolean;
  price: number;
  recipeCost: number;
  unitMargin: number;
  foodCostPct: number;
  targetFoodCostPct: number;
  foodCostGapPct: number; // foodCostPct - targetFoodCostPct
  unitsSold: number;
  grossRevenue: number;
  totalCost: number;
  totalMargin: number;
  menuMixPct: number;
  quadrant: MenuQuadrant;
  quadrantLabel: string;
  isHighProfitability: boolean;
  isHighPopularity: boolean;
  recommendation: string;
  suggestedPriceForTargetCost: number;
  topCostIngredient?: {
    name: string;
    unit: string;
    quantity: number;
    cost: number;
    costSharePct: number;
  } | null;
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || session.activeBrandId;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const categoryIdParam = searchParams.get('categoryId');

    // Default to last 30 days if not provided
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = startDateParam ? new Date(`${startDateParam}T00:00:00.000Z`) : defaultStart;
    const endDate = endDateParam ? new Date(`${endDateParam}T23:59:59.999Z`) : now;

    // 1. Fetch products of the brand with categories and recipe ingredients
    const productWhere: any = { brandId };
    if (categoryIdParam && categoryIdParam !== 'ALL') {
      productWhere.categoryId = categoryIdParam;
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        category: { select: { id: true, name: true } },
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, cost: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      return NextResponse.json({
        summary: {
          totalProducts: 0,
          totalUnitsSold: 0,
          totalGrossRevenue: 0,
          totalFoodCost: 0,
          totalContributionMargin: 0,
          overallFoodCostPct: 0,
          averageContributionMargin: 0,
          popularityThresholdPct: 0,
          popularityThresholdUnits: 0,
          distribution: {
            stars: { count: 0, revenueSharePct: 0, marginSharePct: 0 },
            plowhorses: { count: 0, revenueSharePct: 0, marginSharePct: 0 },
            puzzles: { count: 0, revenueSharePct: 0, marginSharePct: 0 },
            dogs: { count: 0, revenueSharePct: 0, marginSharePct: 0 },
          },
        },
        products: [],
      });
    }

    // 2. Fetch completed/delivered orders within range to aggregate units sold
    const orders = await prisma.order.findMany({
      where: {
        brandId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            price: true,
          },
        },
      },
    });

    // Aggregate sales volume per product
    const salesMap = new Map<string, { quantity: number; revenue: number }>();
    let totalUnitsSold = 0;
    let totalGrossRevenueFromOrders = 0;

    for (const order of orders) {
      for (const item of order.items) {
        const prev = salesMap.get(item.productId) || { quantity: 0, revenue: 0 };
        const qty = item.quantity || 1;
        const rev = (item.price || 0) * qty;
        salesMap.set(item.productId, {
          quantity: prev.quantity + qty,
          revenue: prev.revenue + rev,
        });
        totalUnitsSold += qty;
        totalGrossRevenueFromOrders += rev;
      }
    }

    // 3. Pre-calculate costs and unit margins
    const preliminaryList: Array<{
      product: typeof products[0];
      recipeCost: number;
      unitPrice: number;
      unitMargin: number;
      foodCostPct: number;
      targetFoodCostPct: number;
      unitsSold: number;
      grossRevenue: number;
      totalCost: number;
      totalMargin: number;
      topCostIngredient?: {
        name: string;
        unit: string;
        quantity: number;
        cost: number;
        costSharePct: number;
      } | null;
    }> = [];

    let totalCalculatedCost = 0;
    let totalCalculatedMargin = 0;
    let sumOfUnitMargins = 0;

    for (const p of products) {
      const sales = salesMap.get(p.id) || { quantity: 0, revenue: 0 };
      const unitsSold = sales.quantity;
      const unitPrice = p.price;

      // Calculate total recipe cost
      let recipeCost = 0;
      let topIngredient: { name: string; unit: string; quantity: number; cost: number; costSharePct: number } | null = null;
      let highestCost = -1;

      for (const r of p.recipeItems) {
        const itemCost = (r.quantity || 0) * (r.ingredient?.cost || 0);
        recipeCost += itemCost;
        if (itemCost > highestCost) {
          highestCost = itemCost;
          topIngredient = {
            name: r.ingredient?.name || 'Insumo',
            unit: r.ingredient?.unit || 'u',
            quantity: r.quantity,
            cost: itemCost,
            costSharePct: 0,
          };
        }
      }

      if (topIngredient && recipeCost > 0) {
        topIngredient.costSharePct = parseFloat(((topIngredient.cost / recipeCost) * 100).toFixed(1));
      }

      const unitMargin = unitPrice - recipeCost;
      const foodCostPct = unitPrice > 0 ? parseFloat(((recipeCost / unitPrice) * 100).toFixed(1)) : 0;
      const targetFoodCostPct = p.targetFoodCostPct ?? 30;

      const grossRevenue = unitsSold * unitPrice;
      const totalCost = unitsSold * recipeCost;
      const totalMargin = unitsSold * unitMargin;

      totalCalculatedCost += totalCost;
      totalCalculatedMargin += totalMargin;
      sumOfUnitMargins += unitMargin;

      preliminaryList.push({
        product: p,
        recipeCost,
        unitPrice,
        unitMargin,
        foodCostPct,
        targetFoodCostPct,
        unitsSold,
        grossRevenue,
        totalCost,
        totalMargin,
        topCostIngredient: topIngredient,
      });
    }

    // 4. Threshold benchmarks (Miller & Kasavana Standard)
    const productCount = products.length;
    // Average Contribution Margin: Weighted by sales if there are sales; otherwise arithmetic mean of unit margins
    const averageContributionMargin = totalUnitsSold > 0
      ? totalCalculatedMargin / totalUnitsSold
      : (productCount > 0 ? sumOfUnitMargins / productCount : 0);

    // Popularity threshold: 70% of the equi-share benchmark
    // e.g. 10 products -> equi-share = 10%. Threshold = 10% * 0.70 = 7.0%
    const equiSharePct = productCount > 0 ? 100 / productCount : 0;
    const popularityThresholdPct = parseFloat((equiSharePct * 0.70).toFixed(2));
    const popularityThresholdUnits = totalUnitsSold > 0
      ? parseFloat(((totalUnitsSold / productCount) * 0.70).toFixed(1))
      : 1; // Minimum 1 if no sales

    // 5. Categorize each product into BCG Quadrants and prescribe recommendations
    const analyzedProducts: DishAnalysis[] = [];
    const distribution = {
      stars: { count: 0, revenue: 0, margin: 0 },
      plowhorses: { count: 0, revenue: 0, margin: 0 },
      puzzles: { count: 0, revenue: 0, margin: 0 },
      dogs: { count: 0, revenue: 0, margin: 0 },
    };

    for (const item of preliminaryList) {
      const menuMixPct = totalUnitsSold > 0
        ? parseFloat(((item.unitsSold / totalUnitsSold) * 100).toFixed(2))
        : 0;

      const isHighProfitability = item.unitMargin >= averageContributionMargin;
      const isHighPopularity = totalUnitsSold > 0
        ? item.unitsSold >= popularityThresholdUnits
        : item.unitsSold > 0;

      let quadrant: MenuQuadrant = 'DOG';
      let quadrantLabel = '🐶 Perro (Dog)';
      let recommendation = '';

      // Target price to achieve target food cost percentage (e.g. 30%)
      const targetDecimal = (item.targetFoodCostPct || 30) / 100;
      const suggestedPriceForTargetCost = targetDecimal > 0 && item.recipeCost > 0
        ? parseFloat((item.recipeCost / targetDecimal).toFixed(2))
        : item.unitPrice;

      if (isHighProfitability && isHighPopularity) {
        quadrant = 'STAR';
        quadrantLabel = '🌟 Estrella (Star)';
        recommendation = 'Platillo líder en margen y demanda. Proteger la receta y calidad; mantener porciones estables y destacar en la posición visual #1 del menú digital y comanderos.';
        distribution.stars.count++;
        distribution.stars.revenue += item.grossRevenue;
        distribution.stars.margin += item.totalMargin;
      } else if (!isHighProfitability && isHighPopularity) {
        quadrant = 'PLOWHORSE';
        quadrantLabel = '🐎 Caballo de Batalla (Plowhorse)';
        const priceDiff = suggestedPriceForTargetCost - item.unitPrice;
        const priceAdvice = priceDiff > 0 ? ` Aumentar precio $${priceDiff.toFixed(2)} (a $${suggestedPriceForTargetCost.toFixed(2)})` : '';
        const ingAdvice = item.topCostIngredient ? ` o renegociar costo de ${item.topCostIngredient.name} (${item.topCostIngredient.costSharePct}% del costo).` : '.';
        recommendation = `Alta demanda pero margen por debajo del promedio.${priceAdvice}${ingAdvice} Promover en combo con bebidas de alto margen.`;
        distribution.plowhorses.count++;
        distribution.plowhorses.revenue += item.grossRevenue;
        distribution.plowhorses.margin += item.totalMargin;
      } else if (isHighProfitability && !isHighPopularity) {
        quadrant = 'PUZZLE';
        quadrantLabel = '🧩 Rompecabezas (Puzzle)';
        recommendation = 'Excelente rentabilidad pero baja rotación. Impulsar con badge de "Sugerencia del Chef", renovar fotografía comercial en menú QR y capacitar a meseros en venta sugerida.';
        distribution.puzzles.count++;
        distribution.puzzles.revenue += item.grossRevenue;
        distribution.puzzles.margin += item.totalMargin;
      } else {
        quadrant = 'DOG';
        quadrantLabel = '🐶 Perro (Dog)';
        recommendation = 'Bajo margen y baja demanda. Candidato prioritario a depuración o sustitución para liberar inventario perecedero y reducir horas de preparación en cocina.';
        distribution.dogs.count++;
        distribution.dogs.revenue += item.grossRevenue;
        distribution.dogs.margin += item.totalMargin;
      }

      analyzedProducts.push({
        id: item.product.id,
        name: item.product.name,
        category: item.product.category?.name || 'General',
        categoryId: item.product.categoryId,
        imageUrl: item.product.imageUrl,
        isActive: item.product.isActive,
        price: parseFloat(item.unitPrice.toFixed(2)),
        recipeCost: parseFloat(item.recipeCost.toFixed(2)),
        unitMargin: parseFloat(item.unitMargin.toFixed(2)),
        foodCostPct: item.foodCostPct,
        targetFoodCostPct: item.targetFoodCostPct,
        foodCostGapPct: parseFloat((item.foodCostPct - item.targetFoodCostPct).toFixed(1)),
        unitsSold: item.unitsSold,
        grossRevenue: parseFloat(item.grossRevenue.toFixed(2)),
        totalCost: parseFloat(item.totalCost.toFixed(2)),
        totalMargin: parseFloat(item.totalMargin.toFixed(2)),
        menuMixPct,
        quadrant,
        quadrantLabel,
        isHighProfitability,
        isHighPopularity,
        recommendation,
        suggestedPriceForTargetCost,
        topCostIngredient: item.topCostIngredient,
      });
    }

    // Sort by Total Contribution Margin descending (most impactful dishes first)
    analyzedProducts.sort((a, b) => b.totalMargin - a.totalMargin);

    const overallTotalRevenue = totalGrossRevenueFromOrders > 0 ? totalGrossRevenueFromOrders : 1;
    const overallTotalMarginSafe = totalCalculatedMargin > 0 ? totalCalculatedMargin : 1;

    return NextResponse.json({
      summary: {
        totalProducts: productCount,
        totalUnitsSold,
        totalGrossRevenue: parseFloat(totalGrossRevenueFromOrders.toFixed(2)),
        totalFoodCost: parseFloat(totalCalculatedCost.toFixed(2)),
        totalContributionMargin: parseFloat(totalCalculatedMargin.toFixed(2)),
        overallFoodCostPct: totalGrossRevenueFromOrders > 0
          ? parseFloat(((totalCalculatedCost / totalGrossRevenueFromOrders) * 100).toFixed(1))
          : 0,
        averageContributionMargin: parseFloat(averageContributionMargin.toFixed(2)),
        popularityThresholdPct,
        popularityThresholdUnits,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        distribution: {
          stars: {
            count: distribution.stars.count,
            revenueSharePct: parseFloat(((distribution.stars.revenue / overallTotalRevenue) * 100).toFixed(1)),
            marginSharePct: parseFloat(((distribution.stars.margin / overallTotalMarginSafe) * 100).toFixed(1)),
          },
          plowhorses: {
            count: distribution.plowhorses.count,
            revenueSharePct: parseFloat(((distribution.plowhorses.revenue / overallTotalRevenue) * 100).toFixed(1)),
            marginSharePct: parseFloat(((distribution.plowhorses.margin / overallTotalMarginSafe) * 100).toFixed(1)),
          },
          puzzles: {
            count: distribution.puzzles.count,
            revenueSharePct: parseFloat(((distribution.puzzles.revenue / overallTotalRevenue) * 100).toFixed(1)),
            marginSharePct: parseFloat(((distribution.puzzles.margin / overallTotalMarginSafe) * 100).toFixed(1)),
          },
          dogs: {
            count: distribution.dogs.count,
            revenueSharePct: parseFloat(((distribution.dogs.revenue / overallTotalRevenue) * 100).toFixed(1)),
            marginSharePct: parseFloat(((distribution.dogs.margin / overallTotalMarginSafe) * 100).toFixed(1)),
          },
        },
      },
      products: analyzedProducts,
    });
  } catch (error) {
    console.error('Error in /api/menu-engineering:', error);
    return NextResponse.json({ error: 'Error al generar análisis de ingeniería de menú' }, { status: 500 });
  }
}
