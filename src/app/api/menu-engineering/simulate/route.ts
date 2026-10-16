import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SimulationItemInput {
  productId: string;
  proposedPrice?: number;
  costReductionPct?: number; // e.g. 10 means 10% lower cost
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandId = session.activeBrandId;
    const body = await req.json();
    const { adjustments }: { adjustments: SimulationItemInput[] } = body;

    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json({ error: 'Se requiere una lista de ajustes para simular' }, { status: 400 });
    }

    const productIds = adjustments.map(a => a.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, brandId },
      include: {
        recipeItems: {
          include: {
            ingredient: { select: { cost: true } },
          },
        },
      },
    });

    const simulations = products.map((prod) => {
      const adj = adjustments.find(a => a.productId === prod.id);
      let currentCost = 0;
      for (const r of prod.recipeItems) {
        currentCost += (r.quantity || 0) * (r.ingredient?.cost || 0);
      }

      const currentPrice = prod.price;
      const currentMargin = currentPrice - currentCost;
      const currentFoodCostPct = currentPrice > 0 ? (currentCost / currentPrice) * 100 : 0;

      // Simulated values
      const simulatedPrice = adj?.proposedPrice != null && adj.proposedPrice > 0 ? adj.proposedPrice : currentPrice;
      const reductionFactor = adj?.costReductionPct ? (1 - adj.costReductionPct / 100) : 1;
      const simulatedCost = currentCost * reductionFactor;
      const simulatedMargin = simulatedPrice - simulatedCost;
      const simulatedFoodCostPct = simulatedPrice > 0 ? (simulatedCost / simulatedPrice) * 100 : 0;

      const deltaMargin = simulatedMargin - currentMargin;
      const deltaFoodCostPct = simulatedFoodCostPct - currentFoodCostPct;

      return {
        productId: prod.id,
        name: prod.name,
        current: {
          price: parseFloat(currentPrice.toFixed(2)),
          cost: parseFloat(currentCost.toFixed(2)),
          margin: parseFloat(currentMargin.toFixed(2)),
          foodCostPct: parseFloat(currentFoodCostPct.toFixed(1)),
        },
        simulated: {
          price: parseFloat(simulatedPrice.toFixed(2)),
          cost: parseFloat(simulatedCost.toFixed(2)),
          margin: parseFloat(simulatedMargin.toFixed(2)),
          foodCostPct: parseFloat(simulatedFoodCostPct.toFixed(1)),
        },
        impact: {
          deltaMarginUnit: parseFloat(deltaMargin.toFixed(2)),
          deltaFoodCostPct: parseFloat(deltaFoodCostPct.toFixed(1)),
          annualizedGainAt100MonthlyUnits: parseFloat((deltaMargin * 1200).toFixed(2)),
        },
      };
    });

    return NextResponse.json({ simulations });
  } catch (error) {
    console.error('Error in /api/menu-engineering/simulate:', error);
    return NextResponse.json({ error: 'Error al simular ajustes de ingeniería de menú' }, { status: 500 });
  }
}
