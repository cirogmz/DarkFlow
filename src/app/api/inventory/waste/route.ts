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

    const timeframe = searchParams.get('timeframe') || '30d';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const warehouseId = searchParams.get('warehouseId');
    const station = searchParams.get('station');
    const shift = searchParams.get('shift');
    const reason = searchParams.get('reason');
    const capaStatus = searchParams.get('capaStatus');
    const search = searchParams.get('search')?.toLowerCase().trim();

    // Construct Date Filter
    let dateFilter: { gte?: Date; lte?: Date } = {};
    const now = new Date();

    if (startDateParam && endDateParam) {
      dateFilter = {
        gte: new Date(startDateParam),
        lte: new Date(endDateParam),
      };
    } else if (timeframe === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateFilter = { gte: d };
    } else if (timeframe === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFilter = { gte: d };
    } else if (timeframe === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      dateFilter = { gte: d };
    }

    const whereClause: any = {
      brandId: activeBrandId,
      ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(station ? { station } : {}),
      ...(shift ? { shift } : {}),
      ...(reason ? { reason } : {}),
      ...(capaStatus ? { capaStatus } : {}),
    };

    if (search) {
      whereClause.OR = [
        { ingredient: { name: { contains: search } } },
        { notes: { contains: search } },
        { correctiveAction: { contains: search } },
        { capaAssignee: { contains: search } },
      ];
    }

    const wasteLogs = await prisma.wasteLog.findMany({
      where: whereClause,
      include: {
        ingredient: true,
        warehouse: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let totalWasteCost = 0;
    let totalWasteQuantity = 0;

    // Reason Breakdown
    const reasonBreakdown: Record<string, { count: number; cost: number }> = {};
    // Station Breakdown
    const stationBreakdown: Record<string, { count: number; cost: number }> = {};
    // Shift Breakdown
    const shiftBreakdown: Record<string, { count: number; cost: number }> = {};
    // RCA Category Breakdown
    const rcaBreakdown: Record<string, { count: number; cost: number }> = {};
    // Ingredient Cost Aggregator for Pareto
    const ingredientCostMap: Record<string, { ingredient: any; totalCost: number; totalQuantity: number; events: number }> = {};

    let capaOpenCount = 0;
    let capaInProgressCount = 0;
    let capaResolvedCount = 0;
    let capaCostAtRisk = 0;

    for (const log of wasteLogs) {
      totalWasteCost += log.totalCost;
      totalWasteQuantity += log.quantity;

      // Reason breakdown
      const rKey = log.reason || 'OTHER';
      if (!reasonBreakdown[rKey]) reasonBreakdown[rKey] = { count: 0, cost: 0 };
      reasonBreakdown[rKey].count += 1;
      reasonBreakdown[rKey].cost += log.totalCost;

      // Station breakdown
      const sKey = log.station || 'KITCHEN_HOT';
      if (!stationBreakdown[sKey]) stationBreakdown[sKey] = { count: 0, cost: 0 };
      stationBreakdown[sKey].count += 1;
      stationBreakdown[sKey].cost += log.totalCost;

      // Shift breakdown
      const shKey = log.shift || 'MORNING';
      if (!shiftBreakdown[shKey]) shiftBreakdown[shKey] = { count: 0, cost: 0 };
      shiftBreakdown[shKey].count += 1;
      shiftBreakdown[shKey].cost += log.totalCost;

      // RCA category breakdown
      if (log.rcaCategory) {
        if (!rcaBreakdown[log.rcaCategory]) rcaBreakdown[log.rcaCategory] = { count: 0, cost: 0 };
        rcaBreakdown[log.rcaCategory].count += 1;
        rcaBreakdown[log.rcaCategory].cost += log.totalCost;
      }

      // Pareto ingredient mapping
      const ingId = log.ingredientId;
      if (!ingredientCostMap[ingId]) {
        ingredientCostMap[ingId] = {
          ingredient: {
            id: log.ingredient.id,
            name: log.ingredient.name,
            unit: log.ingredient.unit,
            cost: log.ingredient.cost,
          },
          totalCost: 0,
          totalQuantity: 0,
          events: 0,
        };
      }
      ingredientCostMap[ingId].totalCost += log.totalCost;
      ingredientCostMap[ingId].totalQuantity += log.quantity;
      ingredientCostMap[ingId].events += 1;

      // CAPA counts
      if (log.capaStatus === 'OPEN') {
        capaOpenCount += 1;
        capaCostAtRisk += log.totalCost;
      } else if (log.capaStatus === 'IN_PROGRESS') {
        capaInProgressCount += 1;
        capaCostAtRisk += log.totalCost;
      } else if (log.capaStatus === 'RESOLVED') {
        capaResolvedCount += 1;
      }
    }

    // Compute Pareto 80/20 Distribution
    const paretoItems = Object.values(ingredientCostMap).sort((a, b) => b.totalCost - a.totalCost);
    let cumulativeCost = 0;

    const paretoAnalysis = paretoItems.map((item) => {
      cumulativeCost += item.totalCost;
      const pctOfTotal = totalWasteCost > 0 ? (item.totalCost / totalWasteCost) * 100 : 0;
      const cumulativePct = totalWasteCost > 0 ? (cumulativeCost / totalWasteCost) * 100 : 0;

      let paretoClass: 'A' | 'B' | 'C' = 'C';
      if (cumulativePct <= 80 || (cumulativePct - pctOfTotal < 80)) {
        paretoClass = 'A'; // Vital Few (80% of total loss)
      } else if (cumulativePct <= 95) {
        paretoClass = 'B'; // Next 15%
      } else {
        paretoClass = 'C'; // Trivial Many (Remaining 5%)
      }

      return {
        ...item,
        pctOfTotal: Number(pctOfTotal.toFixed(2)),
        cumulativePct: Number(cumulativePct.toFixed(2)),
        paretoClass,
      };
    });

    // Tag each log with its ingredient's Pareto class
    const paretoClassByIng = new Map(paretoAnalysis.map((p) => [p.ingredient.id, p.paretoClass]));
    const enrichedLogs = wasteLogs.map((log) => ({
      ...log,
      paretoClass: paretoClassByIng.get(log.ingredientId) || 'C',
    }));

    return NextResponse.json({
      wasteLogs: enrichedLogs,
      summary: {
        totalWasteCost,
        totalWasteQuantity,
        totalEvents: wasteLogs.length,
        reasonBreakdown,
        stationBreakdown,
        shiftBreakdown,
        rcaBreakdown,
        capaMetrics: {
          open: capaOpenCount,
          inProgress: capaInProgressCount,
          resolved: capaResolvedCount,
          totalAtRisk: capaCostAtRisk,
        },
        paretoAnalysis,
        paretoSummary: {
          classACount: paretoAnalysis.filter((p) => p.paretoClass === 'A').length,
          classBCount: paretoAnalysis.filter((p) => p.paretoClass === 'B').length,
          classCCount: paretoAnalysis.filter((p) => p.paretoClass === 'C').length,
          classACost: paretoAnalysis.filter((p) => p.paretoClass === 'A').reduce((s, p) => s + p.totalCost, 0),
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching waste logs:', error);
    return NextResponse.json({ error: 'Error al consultar mermas' }, { status: 500 });
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
    const {
      ingredientId,
      quantity,
      reason,
      warehouseId,
      notes,
      shift,
      station,
      rcaCategory,
      rcaWhys,
      correctiveAction,
      capaStatus: inputCapaStatus,
      capaAssignee,
      capaDueDate,
    } = body;

    if (!ingredientId || !quantity || !reason) {
      return NextResponse.json({ error: 'Insumo, cantidad y motivo son obligatorios' }, { status: 400 });
    }

    const wasteQty = parseFloat(quantity);
    if (wasteQty <= 0) {
      return NextResponse.json({ error: 'La cantidad de merma debe ser mayor a 0' }, { status: 400 });
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: ingredientId, brandId: activeBrandId },
    });

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
    }

    const costPerUnit = ingredient.cost;
    const totalCost = costPerUnit * wasteQty;

    // Automatic CAPA activation for critical high-value waste (> $300 MXN or critical classification)
    let capaStatus = inputCapaStatus || 'NONE';
    if (capaStatus === 'NONE' && (totalCost >= 300 || reason === 'KITCHEN_ERROR' || reason.includes('FALTANTE CRÍTICO'))) {
      capaStatus = 'OPEN';
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement main ingredient stock
      const updatedIngredient = await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: {
            decrement: wasteQty,
          },
        },
      });

      // 2. If warehouse is specified, decrement warehouse stock as well
      if (warehouseId) {
        await tx.warehouseStock.upsert({
          where: {
            warehouseId_ingredientId: {
              warehouseId,
              ingredientId,
            },
          },
          update: {
            stock: {
              decrement: wasteQty,
            },
          },
          create: {
            warehouseId,
            ingredientId,
            stock: -wasteQty,
          },
        });
      }

      // 3. Create rich WasteLog with RCA and CAPA fields
      const wasteLog = await tx.wasteLog.create({
        data: {
          ingredientId,
          quantity: wasteQty,
          costPerUnit,
          totalCost,
          reason,
          notes: notes ? String(notes).trim() : null,
          shift: shift || 'MORNING',
          station: station || 'KITCHEN_HOT',
          rcaCategory: rcaCategory || null,
          rcaWhys: rcaWhys ? (typeof rcaWhys === 'string' ? rcaWhys : JSON.stringify(rcaWhys)) : null,
          correctiveAction: correctiveAction ? String(correctiveAction).trim() : null,
          capaStatus,
          capaAssignee: capaAssignee ? String(capaAssignee).trim() : null,
          capaDueDate: capaDueDate ? new Date(capaDueDate) : null,
          warehouseId: warehouseId || null,
          brandId: activeBrandId,
          userId: session.userId,
        },
        include: {
          ingredient: true,
          warehouse: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return { wasteLog, updatedIngredient };
    });

    await recordAuditLog({
      action: 'WASTE_RECORDED',
      entityType: 'INGREDIENT',
      entityId: ingredient.id,
      details: {
        ingredientName: ingredient.name,
        quantity: wasteQty,
        unit: ingredient.unit,
        reason,
        totalCost,
        station: station || 'KITCHEN_HOT',
        shift: shift || 'MORNING',
        capaStatus,
        notes,
      },
      severity: totalCost > 500 ? 'CRITICAL' : 'WARNING',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Error recording waste:', error);
    return NextResponse.json({ error: 'Error al registrar la merma' }, { status: 500 });
  }
}
