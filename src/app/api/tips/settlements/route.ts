import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getOrCreateBrandTipConfig,
  calculateShiftTips,
  getEligibleStaffHours,
  calculateTipDistribution,
  generateTipFolio,
  DistributionModel,
} from '@/lib/tipPool';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    if (!brandId) {
      return NextResponse.json({ error: 'brandId requerido' }, { status: 400 });
    }

    const settlements = await prisma.tipSettlement.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        distributionDetails: true,
      },
    });

    const metrics = {
      totalSettlements: settlements.length,
      totalDispersedAmount: settlements
        .filter((s) => s.status === 'DISPERSED')
        .reduce((acc, s) => acc + s.totalTips, 0),
      totalPendingApproval: settlements
        .filter((s) => s.status === 'DRAFT' || s.status === 'CALCULATED')
        .reduce((acc, s) => acc + s.totalTips, 0),
    };

    return NextResponse.json({
      settlements,
      metrics,
    });
  } catch (error: any) {
    console.error('Error al listar liquidaciones de propinas:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandId,
      shift = 'ALL_DAY',
      periodStart,
      periodEnd,
      manualCashTips,
      manualCardTips,
      manualDigitalTips,
      preview = false,
      notes,
      overrideModel,
    } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId requerido' }, { status: 400 });
    }

    // Resolver rango de fechas
    const start = periodStart ? new Date(periodStart) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = periodEnd ? new Date(periodEnd) : new Date(new Date().setHours(23, 59, 59, 999));

    // 1. Obtener configuración de marca
    const config = await getOrCreateBrandTipConfig(brandId);
    const distributionModel = (overrideModel || config.distributionModel) as DistributionModel;

    // 2. Calcular propinas recaudadas
    const computedTips = await calculateShiftTips({
      brandId,
      periodStart: start,
      periodEnd: end,
      manualCashTips: manualCashTips !== undefined ? Number(manualCashTips) : undefined,
    });

    const cashTips = manualCashTips !== undefined ? Number(manualCashTips) : computedTips.cashTips;
    const cardTips = manualCardTips !== undefined ? Number(manualCardTips) : computedTips.cardTips;
    const digitalTips = manualDigitalTips !== undefined ? Number(manualDigitalTips) : computedTips.digitalTips;

    // Considerar flags de configuración
    let poolTotal = 0;
    if (config.includeCashTips) poolTotal += cashTips;
    if (config.includeCardTips) poolTotal += cardTips;
    if (config.includeDigitalTips) poolTotal += digitalTips;
    poolTotal = Number(poolTotal.toFixed(2));

    // 3. Consultar personal elegible y horas trabajadas
    const staff = await getEligibleStaffHours({
      brandId,
      periodStart: start,
      periodEnd: end,
      minHoursRequired: config.minHoursRequired,
    });

    // 4. Ejecutar algoritmo de reparto
    const distribution = calculateTipDistribution({
      totalTips: poolTotal,
      distributionModel,
      roleRules: config.roleRules,
      staff,
      kitchenKickoutPct: config.kitchenKickoutPct,
      barKickoutPct: config.barKickoutPct,
    });

    // Si sólo es una previsualización interactiva, devolver cálculo sin guardar en BD
    if (preview) {
      return NextResponse.json({
        preview: true,
        periodStart: start,
        periodEnd: end,
        shift,
        distributionModel,
        cashTips,
        cardTips,
        digitalTips,
        totalTips: poolTotal,
        totalHoursWorked: distribution.totalHours,
        totalPoints: distribution.totalPoints,
        staffCount: staff.length,
        items: distribution.items,
      });
    }

    // 5. Guardar Liquidación oficial en BD
    const folio = await generateTipFolio(brandId);

    const settlement = await prisma.tipSettlement.create({
      data: {
        folio,
        brandId,
        shift,
        periodStart: start,
        periodEnd: end,
        cashTips,
        cardTips,
        digitalTips,
        totalTips: poolTotal,
        totalHoursWorked: distribution.totalHours,
        totalPoints: distribution.totalPoints,
        status: 'CALCULATED',
        notes: notes || null,
        distributionDetails: {
          create: distribution.items.map((item) => ({
            userId: item.userId,
            employeeName: item.employeeName,
            role: item.role,
            hoursWorked: item.hoursWorked,
            pointsWeight: item.pointsWeight,
            weightedPoints: item.weightedPoints,
            sharePercentage: item.sharePercentage,
            allocatedAmount: item.allocatedAmount,
            adjustedAmount: item.adjustedAmount,
            adjustmentReason: item.adjustmentReason || null,
            payoutMethod: item.payoutMethod,
            payoutStatus: item.payoutStatus,
          })),
        },
      },
      include: {
        distributionDetails: true,
      },
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error: any) {
    console.error('Error al generar liquidación de propinas:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

