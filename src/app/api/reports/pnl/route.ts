import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HourlyBucket {
  hour: string;
  hourNumber: number;
  netSales: number;
  cogs: number;
  labor: number;
  primeCost: number;
  netMargin: number;
  ordersCount: number;
}

interface WorkerShiftItem {
  userId: string;
  userName: string;
  role: string;
  clockIn: string;
  clockOut: string | null;
  status: string;
  hoursWorked: number;
  hourlyWage: number;
  totalCost: number;
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get('date');
    const sessionIdParam = searchParams.get('sessionId');
    const shiftParam = (searchParams.get('shift') || 'ALL_DAY').toUpperCase();

    // Target Date range
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr = dateParam || todayStr;

    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

    if (shiftParam === 'LUNCH') {
      startOfDay.setUTCHours(11, 0, 0, 0);
      endOfDay.setUTCHours(16, 59, 59, 999);
    } else if (shiftParam === 'DINNER') {
      startOfDay.setUTCHours(17, 0, 0, 0);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    // Fetch Brand and budget targets
    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
      select: {
        id: true,
        name: true,
        targetFoodCostPct: true,
        targetLaborCostPct: true,
        targetPrimeCostPct: true,
        targetDailySales: true,
      },
    });

    const targetFoodCostPct = brand?.targetFoodCostPct ?? 30;
    const targetLaborCostPct = brand?.targetLaborCostPct ?? 20;
    const targetPrimeCostPct = brand?.targetPrimeCostPct ?? 55;
    const targetDailySales = brand?.targetDailySales ?? 15000;

    // Filter orders
    const orderWhere: Record<string, unknown> = {
      brandId: activeBrandId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { notIn: ['CANCELLED'] },
    };

    if (sessionIdParam) {
      // If a specific cash session is selected, match orders linked or in that session interval
      const cashSession = await prisma.cashSession.findUnique({
        where: { id: sessionIdParam },
      });
      if (cashSession) {
        orderWhere.createdAt = {
          gte: cashSession.openedAt,
          lte: cashSession.closedAt || new Date(),
        };
      }
    }

    // Fetch Orders with items, products and recipe explosion
    const orders = await prisma.order.findMany({
      where: orderWhere,
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
      orderBy: { createdAt: 'asc' },
    });

    // Fetch Waste Logs for this day/shift
    const wasteLogs = await prisma.wasteLog.findMany({
      where: {
        brandId: activeBrandId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const totalWasteCost = wasteLogs.reduce((acc, w) => acc + (w.totalCost || 0), 0);

    // Fetch Attendance Records for Labor Cost calculation
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        brandId: activeBrandId,
        clockIn: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            hourlyWage: true,
          },
        },
      },
    });

    // ==============================================================
    // 1. REVENUE CALCULATIONS
    // ==============================================================
    let grossSales = 0;
    let netSales = 0;
    let discountsTotal = 0;
    let compsRetailTotal = 0;
    let compsFoodCostTotal = 0;
    let taxesTotal = 0;
    let tipsTotal = 0;
    let deliveryFeesTotal = 0;

    // Hourly buckets map (0..23)
    const hourlyMap = new Map<number, HourlyBucket>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, {
        hour: `${String(h).padStart(2, '0')}:00`,
        hourNumber: h,
        netSales: 0,
        cogs: 0,
        labor: 0,
        primeCost: 0,
        netMargin: 0,
        ordersCount: 0,
      });
    }

    // Product contribution breakdown
    const productMarginMap = new Map<
      string,
      {
        productName: string;
        unitsSold: number;
        revenue: number;
        cogs: number;
        margin: number;
      }
    >();

    let totalRecipesCogs = 0;

    for (const order of orders) {
      const orderHour = new Date(order.createdAt).getUTCHours();
      const bucket = hourlyMap.get(orderHour);

      const orderSubtotal = order.subtotal || 0;
      const orderTax = order.tax || 0;
      const orderTip = order.tip || 0;
      const orderDeliveryFee = order.deliveryFee || 0;

      grossSales += order.total || orderSubtotal + orderTax + orderTip;
      taxesTotal += orderTax;
      tipsTotal += orderTip;
      deliveryFeesTotal += orderDeliveryFee;

      if (order.isComped) {
        compsRetailTotal += orderSubtotal;
        compsFoodCostTotal += order.compFoodCost || 0;
      } else {
        netSales += orderSubtotal;
        if (bucket) {
          bucket.netSales += orderSubtotal;
          bucket.ordersCount += 1;
        }
      }

      // Calculate real COGS from recipe items
      for (const item of order.items) {
        const prod = item.product;
        const itemQty = item.quantity;
        const itemRevenue = item.price * itemQty;

        let unitRecipeCost = 0;
        if (prod.recipeItems && prod.recipeItems.length > 0) {
          for (const ri of prod.recipeItems) {
            const ingCost = ri.ingredient?.cost || 0;
            unitRecipeCost += ingCost * ri.quantity;
          }
        }

        const itemCogs = unitRecipeCost * itemQty;
        totalRecipesCogs += itemCogs;

        if (bucket) {
          bucket.cogs += itemCogs;
        }

        // Aggregate by product
        if (!productMarginMap.has(prod.id)) {
          productMarginMap.set(prod.id, {
            productName: prod.name,
            unitsSold: 0,
            revenue: 0,
            cogs: 0,
            margin: 0,
          });
        }

        const pData = productMarginMap.get(prod.id)!;
        pData.unitsSold += itemQty;
        pData.revenue += itemRevenue;
        pData.cogs += itemCogs;
        pData.margin += itemRevenue - itemCogs;
      }
    }

    // Total Real COGS = Recipes + Waste + Comps Food Cost
    const totalCOGS = totalRecipesCogs + totalWasteCost + compsFoodCostTotal;
    const foodCostPct = netSales > 0 ? (totalCOGS / netSales) * 100 : 0;
    const foodCostVariance = foodCostPct - targetFoodCostPct;

    // ==============================================================
    // 2. LABOR COST CALCULATIONS
    // ==============================================================
    let totalLaborHours = 0;
    let totalLaborCost = 0;
    const nowTime = new Date().getTime();
    const workersShift: WorkerShiftItem[] = [];

    for (const record of attendanceRecords) {
      const clockInTime = new Date(record.clockIn).getTime();
      let hoursWorked = record.totalHours || 0;

      if (record.status === 'ACTIVE' || !record.clockOut) {
        // Active shift right now
        const elapsedMs = Math.max(0, nowTime - clockInTime);
        const elapsedMinutes = elapsedMs / (1000 * 60) - (record.breakMinutes || 0);
        hoursWorked = Math.max(0, elapsedMinutes / 60);
      }

      const hourlyWage = record.user?.hourlyWage || 65; // $65 MXN / hora baseline
      const workerCost = hoursWorked * hourlyWage;

      totalLaborHours += hoursWorked;
      totalLaborCost += workerCost;

      workersShift.push({
        userId: record.userId,
        userName: record.user?.name || 'Empleado',
        role: record.user?.role || 'STAFF',
        clockIn: record.clockIn.toISOString(),
        clockOut: record.clockOut ? record.clockOut.toISOString() : null,
        status: record.status,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        hourlyWage,
        totalCost: Math.round(workerCost * 100) / 100,
      });

      // Distribute labor cost into hourly buckets for timeline
      const startH = new Date(record.clockIn).getUTCHours();
      const endH = record.clockOut ? new Date(record.clockOut).getUTCHours() : new Date().getUTCHours();

      const spanHours = Math.max(1, endH >= startH ? endH - startH + 1 : 24 - startH + endH + 1);
      const costPerHour = workerCost / spanHours;

      for (let h = startH; h <= endH; h++) {
        const bucket = hourlyMap.get(h % 24);
        if (bucket) {
          bucket.labor += costPerHour;
        }
      }
    }

    const laborCostPct = netSales > 0 ? (totalLaborCost / netSales) * 100 : 0;
    const laborCostVariance = laborCostPct - targetLaborCostPct;

    // ==============================================================
    // 3. PRIME COST & NET OPERATING MARGIN
    // ==============================================================
    const primeCostTotal = totalCOGS + totalLaborCost;
    const primeCostPct = netSales > 0 ? (primeCostTotal / netSales) * 100 : 0;
    const primeCostVariance = primeCostPct - targetPrimeCostPct;

    let primeCostHealth: 'HEALTHY' | 'AT_RISK' | 'CRITICAL' = 'HEALTHY';
    if (primeCostPct > targetPrimeCostPct + 7) {
      primeCostHealth = 'CRITICAL';
    } else if (primeCostPct > targetPrimeCostPct) {
      primeCostHealth = 'AT_RISK';
    }

    const netContributionMargin = netSales - primeCostTotal;
    const netContributionMarginPct = netSales > 0 ? (netContributionMargin / netSales) * 100 : 0;

    // Complete hourly buckets
    const hourlyTimeline: HourlyBucket[] = [];
    for (let h = 0; h < 24; h++) {
      const b = hourlyMap.get(h)!;
      b.netSales = Math.round(b.netSales * 100) / 100;
      b.cogs = Math.round(b.cogs * 100) / 100;
      b.labor = Math.round(b.labor * 100) / 100;
      b.primeCost = Math.round((b.cogs + b.labor) * 100) / 100;
      b.netMargin = Math.round((b.netSales - b.primeCost) * 100) / 100;
      hourlyTimeline.push(b);
    }

    // Sort top dish margin contributors
    const topDishesMargin = Array.from(productMarginMap.values())
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8)
      .map((d) => ({
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        cogs: Math.round(d.cogs * 100) / 100,
        margin: Math.round(d.margin * 100) / 100,
        marginPct: d.revenue > 0 ? Math.round((d.margin / d.revenue) * 1000) / 10 : 0,
      }));

    // Diagnostic Actionable Insights
    const insights: string[] = [];
    if (netSales >= targetDailySales) {
      insights.push(`🎯 Meta de ventas superada: $${netSales.toFixed(2)} vs objetivo de $${targetDailySales.toFixed(2)}.`);
    } else if (netSales > 0) {
      const salesPct = Math.round((netSales / targetDailySales) * 100);
      insights.push(`📊 Progreso de ventas del turno: ${salesPct}% de la meta proyectada ($${targetDailySales.toFixed(2)}).`);
    }

    if (foodCostPct <= targetFoodCostPct) {
      insights.push(`🥗 Food Cost saludable: ${foodCostPct.toFixed(1)}% (Meta: ${targetFoodCostPct}%). Insumos y escandallos bajo control.`);
    } else {
      insights.push(`⚠️ Desvío en Food Cost: ${foodCostPct.toFixed(1)}% (+${foodCostVariance.toFixed(1)}% sobre meta). Revisa mermas ($${totalWasteCost.toFixed(2)}) y gramajes.`);
    }

    if (laborCostPct <= targetLaborCostPct) {
      insights.push(`👥 Costo de mano de obra óptimo: ${laborCostPct.toFixed(1)}% (Meta: ${targetLaborCostPct}%). Productividad de personal equilibrada.`);
    } else if (laborCostPct > 0) {
      insights.push(`⚠️ Costo laboral elevado: ${laborCostPct.toFixed(1)}% (+${laborCostVariance.toFixed(1)}% sobre meta). Escalonar turnos en horas valle.`);
    }

    if (primeCostHealth === 'HEALTHY') {
      insights.push(`⭐ Prime Cost excelente (${primeCostPct.toFixed(1)}% <= ${targetPrimeCostPct}%). Máxima rentabilidad restaurantera.`);
    } else if (primeCostHealth === 'CRITICAL') {
      insights.push(`🚨 Prime Cost crítico (${primeCostPct.toFixed(1)}%). La suma de insumos y nómina compromete el margen operativo.`);
    }

    return NextResponse.json({
      summary: {
        date: targetDateStr,
        shift: shiftParam,
        ordersCount: orders.length,
        averageTicket: orders.length > 0 ? Math.round((netSales / orders.length) * 100) / 100 : 0,
        grossSales: Math.round(grossSales * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        discountsTotal: Math.round(discountsTotal * 100) / 100,
        compsRetailTotal: Math.round(compsRetailTotal * 100) / 100,
        taxesTotal: Math.round(taxesTotal * 100) / 100,
        tipsTotal: Math.round(tipsTotal * 100) / 100,
        deliveryFeesTotal: Math.round(deliveryFeesTotal * 100) / 100,
        // COGS
        recipesCogs: Math.round(totalRecipesCogs * 100) / 100,
        wasteCost: Math.round(totalWasteCost * 100) / 100,
        compsFoodCost: Math.round(compsFoodCostTotal * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        foodCostPct: Math.round(foodCostPct * 10) / 10,
        foodCostVariance: Math.round(foodCostVariance * 10) / 10,
        targetFoodCostPct,
        // Labor
        totalLaborCost: Math.round(totalLaborCost * 100) / 100,
        totalLaborHours: Math.round(totalLaborHours * 10) / 10,
        headcount: workersShift.length,
        laborCostPct: Math.round(laborCostPct * 10) / 10,
        laborCostVariance: Math.round(laborCostVariance * 10) / 10,
        targetLaborCostPct,
        // Prime Cost
        primeCostTotal: Math.round(primeCostTotal * 100) / 100,
        primeCostPct: Math.round(primeCostPct * 10) / 10,
        primeCostVariance: Math.round(primeCostVariance * 10) / 10,
        targetPrimeCostPct,
        primeCostHealth,
        // Net Operating Contribution
        netContributionMargin: Math.round(netContributionMargin * 100) / 100,
        netContributionMarginPct: Math.round(netContributionMarginPct * 10) / 10,
        targetDailySales,
      },
      hourlyTimeline,
      topDishesMargin,
      workersShift,
      insights,
    });
  } catch (error: unknown) {
    console.error('Error in /api/reports/pnl:', error);
    return NextResponse.json({ error: 'Error al calcular reporte de P&L en tiempo real' }, { status: 500 });
  }
}
