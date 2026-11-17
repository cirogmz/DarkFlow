import { prisma } from '@/lib/db';

export type DistributionModel = 'POINTS_HOURS' | 'PERCENTAGE_DIRECT' | 'EQUAL_SPLIT';

export interface DefaultTipRole {
  role: string;
  roleDisplayName: string;
  pointsWeight: number;
  percentageShare: number;
}

export const DEFAULT_TIP_ROLES: DefaultTipRole[] = [
  { role: 'WAITER', roleDisplayName: 'Meseros de Piso', pointsWeight: 10, percentageShare: 50 },
  { role: 'BARTENDER', roleDisplayName: 'Bartenders & Barra', pointsWeight: 6, percentageShare: 15 },
  { role: 'KITCHEN', roleDisplayName: 'Cocineros & Línea Caliente', pointsWeight: 5, percentageShare: 20 },
  { role: 'RUNNER', roleDisplayName: 'Garroteros / Ayudantes', pointsWeight: 4, percentageShare: 10 },
  { role: 'HOSTESS', roleDisplayName: 'Hostess / Recepción', pointsWeight: 3, percentageShare: 5 },
  { role: 'DISHWASHER', roleDisplayName: 'Lavalozas / Stewards', pointsWeight: 3, percentageShare: 0 },
  { role: 'CASHIER', roleDisplayName: 'Cajeros & Cobro', pointsWeight: 2, percentageShare: 0 },
];

export interface WorkerHours {
  userId: string;
  employeeName: string;
  role: string;
  hoursWorked: number;
}

export interface CalculatedWorkerDisbursement {
  userId: string | null;
  employeeName: string;
  role: string;
  hoursWorked: number;
  pointsWeight: number;
  weightedPoints: number;
  sharePercentage: number;
  allocatedAmount: number;
  adjustedAmount: number;
  adjustmentReason?: string;
  payoutMethod: 'CASH' | 'PAYROLL' | 'SPEI';
  payoutStatus: 'PENDING' | 'PAID';
}

/**
 * Obtiene o crea la configuración de Tip Pooling de una marca
 */
export async function getOrCreateBrandTipConfig(brandId: string) {
  let config = await prisma.tipPoolConfig.findUnique({
    where: { brandId },
    include: {
      roleRules: true,
    },
  });

  if (!config) {
    config = await prisma.tipPoolConfig.create({
      data: {
        brandId,
        isEnabled: true,
        distributionModel: 'POINTS_HOURS',
        includeCashTips: true,
        includeCardTips: true,
        includeDigitalTips: true,
        kitchenKickoutPct: 0,
        barKickoutPct: 0,
        minHoursRequired: 1.0,
        roleRules: {
          create: DEFAULT_TIP_ROLES.map((r) => ({
            role: r.role,
            roleDisplayName: r.roleDisplayName,
            pointsWeight: r.pointsWeight,
            percentageShare: r.percentageShare,
            isActive: true,
          })),
        },
      },
      include: {
        roleRules: true,
      },
    });
  }

  return config;
}

/**
 * Consulta las propinas recaudadas en órdenes y cortes de caja en un periodo
 */
export async function calculateShiftTips(params: {
  brandId: string;
  periodStart: Date;
  periodEnd: Date;
  manualCashTips?: number;
}) {
  const { brandId, periodStart, periodEnd, manualCashTips } = params;

  // 1. Obtener propinas registradas en Orders
  const orders = await prisma.order.findMany({
    where: {
      brandId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: { not: 'CANCELLED' },
      tip: { gt: 0 },
    },
    select: {
      id: true,
      tip: true,
      paymentMethod: true,
    },
  });

  let cardTips = 0;
  let digitalTips = 0;
  let orderCashTips = 0;

  for (const o of orders) {
    const tipVal = o.tip || 0;
    const method = o.paymentMethod || 'CASH';

    if (method === 'CASH') {
      orderCashTips += tipVal;
    } else if (method === 'STRIPE' || method === 'MERCADOPAGO' || method === 'WALLET') {
      digitalTips += tipVal;
    } else {
      cardTips += tipVal;
    }
  }

  // 2. Obtener propinas de cortes de caja de turno en ese periodo si existen
  const cashCuts = await prisma.cashCut.findMany({
    where: {
      cashSession: { brandId },
      cutAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      tipsCash: true,
      tipsCard: true,
      tipsTotal: true,
    },
  });

  let cutCashTips = 0;
  let cutCardTips = 0;
  for (const c of cashCuts) {
    cutCashTips += c.tipsCash || 0;
    cutCardTips += c.tipsCard || 0;
  }

  // Consolidar: dar prioridad al mayor registro (corte o sumatoria de órdenes) o manual si fue provisto
  let finalCash = manualCashTips !== undefined 
    ? Number(manualCashTips) 
    : Math.max(orderCashTips, cutCashTips);
  let finalCard = Math.max(cardTips, cutCardTips);
  let finalDigital = digitalTips;

  const totalTips = Number((finalCash + finalCard + finalDigital).toFixed(2));

  return {
    cashTips: Number(finalCash.toFixed(2)),
    cardTips: Number(finalCard.toFixed(2)),
    digitalTips: Number(finalDigital.toFixed(2)),
    totalTips,
  };
}

/**
 * Consulta el personal activo y horas trabajadas desde AttendanceRecord en el periodo
 */
export async function getEligibleStaffHours(params: {
  brandId: string;
  periodStart: Date;
  periodEnd: Date;
  minHoursRequired?: number;
}): Promise<WorkerHours[]> {
  const { brandId, periodStart, periodEnd, minHoursRequired = 0 } = params;

  // 1. Buscar registros de asistencia en el rango
  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      brandId,
      clockIn: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    include: {
      user: true,
    },
  });

  const workerMap = new Map<string, WorkerHours>();

  for (const att of attendance) {
    if (!att.user) continue;

    let hours = att.totalHours || 0;
    if (!hours && att.clockIn) {
      const end = att.clockOut || (new Date() < periodEnd ? new Date() : periodEnd);
      const diffMs = Math.max(0, end.getTime() - att.clockIn.getTime());
      const rawHours = diffMs / (1000 * 60 * 60);
      hours = Math.max(0, rawHours - ((att.breakMinutes || 0) / 60));
    }

    const existing = workerMap.get(att.userId);
    if (existing) {
      existing.hoursWorked += hours;
    } else {
      workerMap.set(att.userId, {
        userId: att.userId,
        employeeName: att.user.name,
        role: att.user.role || 'WAITER',
        hoursWorked: hours,
      });
    }
  }

  // 2. Si no hay registros de reloj checador (modo prueba o inicio de turno),
  // buscamos usuarios asignados a la marca para simular su turno
  if (workerMap.size === 0) {
    const brandUsers = await prisma.userBrand.findMany({
      where: { brandId },
      include: { user: true },
      take: 8,
    });

    for (const ub of brandUsers) {
      if (ub.user && ub.user.role !== 'SUPER_ADMIN') {
        workerMap.set(ub.userId, {
          userId: ub.userId,
          employeeName: ub.user.name,
          role: ub.user.role || 'WAITER',
          hoursWorked: 8.0, // Jornada estándar de muestra
        });
      }
    }
  }

  // Filtrar por horas mínimas
  const result: WorkerHours[] = [];
  for (const w of workerMap.values()) {
    w.hoursWorked = Number(w.hoursWorked.toFixed(2));
    if (w.hoursWorked >= minHoursRequired) {
      result.push(w);
    }
  }

  return result;
}

/**
 * Calcula el reparto individual de la bolsa de propinas según la configuración
 */
export function calculateTipDistribution(params: {
  totalTips: number;
  distributionModel: DistributionModel;
  roleRules: Array<{ role: string; pointsWeight: number; percentageShare: number; isActive: boolean }>;
  staff: WorkerHours[];
  kitchenKickoutPct?: number;
  barKickoutPct?: number;
}): {
  items: CalculatedWorkerDisbursement[];
  totalPoints: number;
  totalHours: number;
} {
  const {
    totalTips,
    distributionModel,
    roleRules,
    staff,
    kitchenKickoutPct = 0,
    barKickoutPct = 0,
  } = params;

  if (staff.length === 0 || totalTips <= 0) {
    return { items: [], totalPoints: 0, totalHours: 0 };
  }

  const roleRuleMap = new Map(roleRules.map((r) => [r.role.toUpperCase(), r]));

  const totalHours = Number(staff.reduce((acc, s) => acc + s.hoursWorked, 0).toFixed(2));

  // Retención opcional de kick-out para cocina y barra
  const kitchenKickoutAmount = Number((totalTips * (kitchenKickoutPct / 100)).toFixed(2));
  const barKickoutAmount = Number((totalTips * (barKickoutPct / 100)).toFixed(2));
  const mainPool = Number((totalTips - kitchenKickoutAmount - barKickoutAmount).toFixed(2));

  let items: CalculatedWorkerDisbursement[] = [];
  let totalPoints = 0;

  // =========================================================================
  // MODELO 1: PUNTOS PONDERADOS POR HORAS (POINTS_HOURS) - Estándar Internacional
  // =========================================================================
  if (distributionModel === 'POINTS_HOURS') {
    // 1. Calcular puntos ponderados para cada colaborador
    for (const member of staff) {
      const rule = roleRuleMap.get(member.role.toUpperCase());
      const pointsWeight = rule ? rule.pointsWeight : 5;
      const weightedPoints = Number((member.hoursWorked * pointsWeight).toFixed(2));
      totalPoints += weightedPoints;

      items.push({
        userId: member.userId,
        employeeName: member.employeeName,
        role: member.role,
        hoursWorked: member.hoursWorked,
        pointsWeight,
        weightedPoints,
        sharePercentage: 0,
        allocatedAmount: 0,
        adjustedAmount: 0,
        payoutMethod: 'CASH',
        payoutStatus: 'PENDING',
      });
    }

    totalPoints = Number(totalPoints.toFixed(2));

    // 2. Distribuir monto proporcionalmente
    if (totalPoints > 0) {
      for (const item of items) {
        const sharePct = (item.weightedPoints / totalPoints) * 100;
        item.sharePercentage = Number(sharePct.toFixed(2));
        const rawAmount = (mainPool * (item.weightedPoints / totalPoints));
        item.allocatedAmount = Number(rawAmount.toFixed(2));
        item.adjustedAmount = item.allocatedAmount;
      }
    }
  }

  // =========================================================================
  // MODELO 2: PORCENTAJES DIRECTOS POR PUESTO (PERCENTAGE_DIRECT)
  // =========================================================================
  else if (distributionModel === 'PERCENTAGE_DIRECT') {
    // Agrupar personal por rol
    const staffByRole = new Map<string, WorkerHours[]>();
    for (const member of staff) {
      const roleKey = member.role.toUpperCase();
      if (!staffByRole.has(roleKey)) staffByRole.set(roleKey, []);
      staffByRole.get(roleKey)!.push(member);
    }

    // Calcular suma total de porcentajes configurados
    let configuredSumPct = 0;
    for (const roleKey of staffByRole.keys()) {
      const rule = roleRuleMap.get(roleKey);
      configuredSumPct += (rule?.percentageShare || 10);
    }
    if (configuredSumPct === 0) configuredSumPct = 100;

    for (const [roleKey, roleStaff] of staffByRole.entries()) {
      const rule = roleRuleMap.get(roleKey);
      const rawRolePct = rule?.percentageShare || (100 / staffByRole.size);
      const normalizedRolePct = (rawRolePct / configuredSumPct);
      const rolePool = mainPool * normalizedRolePct;

      const roleHours = roleStaff.reduce((acc, s) => acc + s.hoursWorked, 0);

      for (const member of roleStaff) {
        const pointsWeight = rule ? rule.pointsWeight : 1;
        totalPoints += member.hoursWorked;

        const workerShareOfRole = roleHours > 0 ? (member.hoursWorked / roleHours) : (1 / roleStaff.length);
        const allocated = rolePool * workerShareOfRole;
        const totalSharePct = (allocated / mainPool) * 100;

        items.push({
          userId: member.userId,
          employeeName: member.employeeName,
          role: member.role,
          hoursWorked: member.hoursWorked,
          pointsWeight,
          weightedPoints: member.hoursWorked,
          sharePercentage: Number(totalSharePct.toFixed(2)),
          allocatedAmount: Number(allocated.toFixed(2)),
          adjustedAmount: Number(allocated.toFixed(2)),
          payoutMethod: 'CASH',
          payoutStatus: 'PENDING',
        });
      }
    }
    totalPoints = totalHours;
  }

  // =========================================================================
  // MODELO 3: PARTES IGUALES PONDERADAS POR HORAS (EQUAL_SPLIT)
  // =========================================================================
  else {
    totalPoints = totalHours;
    for (const member of staff) {
      const sharePct = totalHours > 0 ? (member.hoursWorked / totalHours) * 100 : (100 / staff.length);
      const allocated = totalHours > 0 ? (mainPool * (member.hoursWorked / totalHours)) : (mainPool / staff.length);

      items.push({
        userId: member.userId,
        employeeName: member.employeeName,
        role: member.role,
        hoursWorked: member.hoursWorked,
        pointsWeight: 1,
        weightedPoints: member.hoursWorked,
        sharePercentage: Number(sharePct.toFixed(2)),
        allocatedAmount: Number(allocated.toFixed(2)),
        adjustedAmount: Number(allocated.toFixed(2)),
        payoutMethod: 'CASH',
        payoutStatus: 'PENDING',
      });
    }
  }

  // Si hay kickout para cocina o barra, repartirlo entre colaboradores de ese rol
  if (kitchenKickoutAmount > 0) {
    const kitchenStaff = items.filter((i) => i.role.toUpperCase() === 'KITCHEN');
    if (kitchenStaff.length > 0) {
      const share = kitchenKickoutAmount / kitchenStaff.length;
      for (const k of kitchenStaff) {
        k.allocatedAmount = Number((k.allocatedAmount + share).toFixed(2));
        k.adjustedAmount = k.allocatedAmount;
        k.adjustmentReason = `Incluye kickout de cocina ($${share.toFixed(2)})`;
      }
    }
  }

  if (barKickoutAmount > 0) {
    const barStaff = items.filter((i) => i.role.toUpperCase() === 'BARTENDER');
    if (barStaff.length > 0) {
      const share = barKickoutAmount / barStaff.length;
      for (const b of barStaff) {
        b.allocatedAmount = Number((b.allocatedAmount + share).toFixed(2));
        b.adjustedAmount = b.allocatedAmount;
        b.adjustmentReason = `Incluye kickout de barra ($${share.toFixed(2)})`;
      }
    }
  }

  // Ajuste de centavos residuales para conservación exacta de la bolsa
  const distributedSum = Number(items.reduce((acc, i) => acc + i.adjustedAmount, 0).toFixed(2));
  const diff = Number((totalTips - distributedSum).toFixed(2));

  if (diff !== 0 && items.length > 0) {
    // Asignar el centavo al mayor perceptor
    items.sort((a, b) => b.adjustedAmount - a.adjustedAmount);
    items[0].adjustedAmount = Number((items[0].adjustedAmount + diff).toFixed(2));
  }

  return {
    items,
    totalPoints,
    totalHours,
  };
}

/**
 * Genera el siguiente folio correlativo de liquidación de propinas
 */
export async function generateTipFolio(brandId: string): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.tipSettlement.count({
    where: {
      brandId,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  const nextSeq = String(count + 1).padStart(3, '0');
  return `TIP-${dateStr}-${nextSeq}`;
}

/**
 * Genera el comprobante térmico ESC/POS de 80mm para firma de conformidad del colaborador
 */
export function generateThermalTipReceipt(params: {
  brandName: string;
  folio: string;
  shift: string;
  periodStart: Date;
  periodEnd: Date;
  item: {
    employeeName: string;
    role: string;
    hoursWorked: number;
    pointsWeight: number;
    weightedPoints: number;
    sharePercentage: number;
    adjustedAmount: number;
    payoutMethod: string;
  };
  totalPool: number;
}): string {
  const { brandName, folio, shift, periodStart, periodEnd, item, totalPool } = params;

  const dateFmt = (d: Date) => d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

  return `
========================================
       ${brandName.toUpperCase()}
   COMPROBANTE DE PAGO DE PROPINAS
========================================
FOLIO: ${folio}
TURNO: ${shift}
PERIODO: ${dateFmt(periodStart)}
      a  ${dateFmt(periodEnd)}
----------------------------------------
COLABORADOR: ${item.employeeName}
PUESTO:      ${item.role}
----------------------------------------
HORAS TRABAJADAS:   ${item.hoursWorked} hrs
FACTOR PUNTOS:      ${item.pointsWeight} pts
PUNTOS TOTALES:     ${item.weightedPoints}
PARTICIPACIÓN:      ${item.sharePercentage}%
----------------------------------------
BOLSA TOTAL MARCA:  $${totalPool.toFixed(2)} MXN
PROPINA A RECIBIR:  $${item.adjustedAmount.toFixed(2)} MXN
MÉTODO DE PAGO:     ${item.payoutMethod}
========================================

FIRMA DE CONFORMIDAD:



________________________________________
   ${item.employeeName}

Recibí a mi entera conformidad el importe
correspondiente al reparto de propinas del
turno según la política interna del restaurante.

Impreso: ${dateFmt(new Date())}
DarkFlow Tip Engine v1.59
========================================
`.trim();
}

/**
 * Exporta el reparto de liquidación a formato CSV con UTF-8 BOM
 */
export function exportSettlementToCsv(settlement: any): string {
  const BOM = '\uFEFF';
  const headers = [
    'Folio Liquidación',
    'Fecha',
    'Turno',
    'Colaborador',
    'Puesto / Rol',
    'Horas Trabajadas',
    'Puntos Base',
    'Puntos Ponderados',
    '% Participación',
    'Monto Propina (MXN)',
    'Ajuste',
    'Método de Pago',
    'Estatus de Pago',
    'Notas',
  ];

  const rows = (settlement.distributionDetails || []).map((d: any) => [
    settlement.folio,
    new Date(settlement.createdAt).toLocaleDateString('es-MX'),
    settlement.shift,
    `"${d.employeeName.replace(/"/g, '""')}"`,
    d.role,
    d.hoursWorked,
    d.pointsWeight,
    d.weightedPoints,
    `${d.sharePercentage}%`,
    d.adjustedAmount.toFixed(2),
    d.adjustmentReason ? `"${d.adjustmentReason.replace(/"/g, '""')}"` : '',
    d.payoutMethod,
    d.payoutStatus,
    d.notes ? `"${d.notes.replace(/"/g, '""')}"` : '',
  ]);

  return BOM + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\r\n');
}
