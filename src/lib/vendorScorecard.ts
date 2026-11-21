export interface ItemReceptionAudit {
  itemId: string;
  orderedUnitCost: number;
  billedUnitCost: number;
  quantityOrdered: number;
  quantityReceived: number;
  rejectedQuantity?: number;
  rejectionReason?: string;
  priceVariance: number;
  priceVariancePct: number;
}

export interface OtifAuditResult {
  isOnTime: boolean;
  isInFull: boolean;
  isOtif: boolean;
  delayDays: number;
  fulfillmentRatePct: number;
  priceVarianceAmount: number;
  priceVariancePct: number;
  qualityScore: number;
  items: ItemReceptionAudit[];
}

export interface SupplierScorecardMetrics {
  totalOrders: number;
  onTimeOrders: number;
  inFullOrders: number;
  otifOrders: number;
  otifRatePct: number;
  avgPriceVariancePct: number;
  incidentCount: number;
  criticalIncidents: number;
  overallScore: number;
  ratingTier: 'A' | 'B' | 'C' | 'D';
}

/**
 * Calculates OTIF (On-Time In-Full) and Purchase Price Variance (PPV) for a PO reception
 */
export function calculateOtifAndVariance(
  po: {
    createdAt: Date | string;
    expectedDate?: Date | string | null;
    supplier?: { leadTimeDays?: number | null } | null;
    items: Array<{
      id: string;
      quantityOrdered: number;
      quantityReceived: number;
      unitCost: number;
      billedUnitCost?: number | null;
    }>;
  },
  receivedInputs: Array<{
    itemId: string;
    quantityReceived: number | string;
    unitCost?: number | string;
    rejectedQuantity?: number | string;
    rejectionReason?: string;
  }>,
  receivedDate: Date = new Date()
): OtifAuditResult {
  const itemMap = new Map(po.items.map((it) => [it.id, it]));
  
  // 1. Calculate Target Expected Date
  let targetDate: Date;
  if (po.expectedDate) {
    targetDate = new Date(po.expectedDate);
  } else {
    const leadTime = po.supplier?.leadTimeDays ?? 1;
    targetDate = new Date(new Date(po.createdAt).getTime() + leadTime * 24 * 60 * 60 * 1000);
  }

  // Calculate Delay in Days (considering calendar day boundaries)
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const deliveryDay = new Date(receivedDate.getFullYear(), receivedDate.getMonth(), receivedDate.getDate()).getTime();
  const diffMs = deliveryDay - targetDay;
  const delayDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isOnTime = diffMs <= 0;

  // 2. Process Items, Quantities, and Price Variances
  const itemsAudit: ItemReceptionAudit[] = [];
  let totalOrderedQty = 0;
  let totalCumulativeReceivedQty = 0;
  let totalOrderedCostBasis = 0;
  let totalBilledCostBasis = 0;
  let totalRejectedQty = 0;

  for (const rx of receivedInputs) {
    const originalItem = itemMap.get(rx.itemId);
    if (!originalItem) continue;

    const qtyNow = Math.max(0, parseFloat(String(rx.quantityReceived)) || 0);
    const rejectedQty = Math.max(0, parseFloat(String(rx.rejectedQuantity)) || 0);
    const orderedCost = originalItem.unitCost || 0;
    const billedCost = rx.unitCost !== undefined && !isNaN(parseFloat(String(rx.unitCost)))
      ? parseFloat(String(rx.unitCost))
      : orderedCost;

    const unitVariance = billedCost - orderedCost;
    const itemVarianceTotal = unitVariance * qtyNow;
    const itemVariancePct = orderedCost > 0 ? (unitVariance / orderedCost) * 100 : 0;

    itemsAudit.push({
      itemId: originalItem.id,
      orderedUnitCost: orderedCost,
      billedUnitCost: billedCost,
      quantityOrdered: originalItem.quantityOrdered,
      quantityReceived: originalItem.quantityReceived + qtyNow,
      rejectedQuantity: rejectedQty,
      rejectionReason: rx.rejectionReason?.trim() || undefined,
      priceVariance: Math.round(itemVarianceTotal * 100) / 100,
      priceVariancePct: Math.round(itemVariancePct * 100) / 100,
    });

    totalRejectedQty += rejectedQty;
  }

  // Calculate full PO totals
  for (const item of po.items) {
    totalOrderedQty += item.quantityOrdered;
    const auditItem = itemsAudit.find((a) => a.itemId === item.id);
    const finalReceived = auditItem ? auditItem.quantityReceived : item.quantityReceived;
    const finalBilledCost = auditItem ? auditItem.billedUnitCost : (item.billedUnitCost ?? item.unitCost);
    
    totalCumulativeReceivedQty += finalReceived;
    totalOrderedCostBasis += item.quantityOrdered * item.unitCost;
    totalBilledCostBasis += finalReceived * finalBilledCost;
  }

  // 3. Fulfillment Rate and In-Full evaluation
  const fulfillmentRatePct = totalOrderedQty > 0 
    ? Math.round((totalCumulativeReceivedQty / totalOrderedQty) * 10000) / 100
    : 100;
  
  // In-Full standard threshold: at least 98% fulfilled
  const isInFull = fulfillmentRatePct >= 98;
  const isOtif = isOnTime && isInFull;

  // 4. Net Price Variance across this reception
  const netVarianceAmount = Math.round(
    itemsAudit.reduce((acc, curr) => acc + curr.priceVariance, 0) * 100
  ) / 100;
  
  const orderedSubtotalForReceived = itemsAudit.reduce(
    (acc, curr) => acc + (curr.orderedUnitCost * (curr.quantityReceived - (itemMap.get(curr.itemId)?.quantityReceived || 0))),
    0
  );

  const netVariancePct = orderedSubtotalForReceived > 0
    ? Math.round((netVarianceAmount / orderedSubtotalForReceived) * 10000) / 100
    : 0;

  // 5. Quality Score (base 100, minus penalties for rejection or delay)
  let qualityDeduction = 0;
  if (!isOnTime) {
    qualityDeduction += Math.min(25, delayDays * 5); // 5 pts per day late, max 25
  }
  if (!isInFull) {
    qualityDeduction += Math.min(25, Math.round((100 - fulfillmentRatePct) * 0.5));
  }
  if (totalRejectedQty > 0 && totalOrderedQty > 0) {
    qualityDeduction += Math.min(30, Math.round((totalRejectedQty / totalOrderedQty) * 100));
  }
  if (netVariancePct > 2) {
    qualityDeduction += Math.min(20, Math.round(netVariancePct * 2));
  }

  const qualityScore = Math.max(0, Math.min(100, Math.round(100 - qualityDeduction)));

  return {
    isOnTime,
    isInFull,
    isOtif,
    delayDays,
    fulfillmentRatePct,
    priceVarianceAmount: netVarianceAmount,
    priceVariancePct: netVariancePct,
    qualityScore,
    items: itemsAudit,
  };
}

/**
 * Calculates overall supplier rating (0-100) and assigned Tier (A, B, C, D)
 * - 40% OTIF Compliance
 * - 30% Price Variance Compliance
 * - 30% Incident & Quality Score
 */
export function calculateSupplierRating(stats: {
  totalOrders: number;
  otifRatePct: number;
  avgPriceVariancePct: number;
  incidentCount?: number;
  criticalIncidents?: number;
}): { score: number; tier: 'A' | 'B' | 'C' | 'D' } {
  if (!stats.totalOrders || stats.totalOrders <= 0) {
    return { score: 100, tier: 'A' };
  }

  // 1. OTIF Score (0 - 40 pts)
  const otifClamped = Math.max(0, Math.min(100, stats.otifRatePct));
  const otifPoints = (otifClamped / 100) * 40;

  // 2. Price Variance Score (0 - 30 pts)
  // 0% or negative variance = 30 pts full.
  // Above 0%: penalty of 3 pts per 1% variance, reaching 0 pts at 10% variance.
  const priceVariance = Math.max(0, stats.avgPriceVariancePct);
  const priceScorePct = Math.max(0, 100 - priceVariance * 10);
  const pricePoints = (priceScorePct / 100) * 30;

  // 3. Quality & Incident Score (0 - 30 pts)
  const totalIncidents = stats.incidentCount || 0;
  const criticals = stats.criticalIncidents || 0;
  // Penalty: 3 pts per standard incident, 10 pts per critical incident per 10 orders
  const incidentsPer10Orders = (totalIncidents / Math.max(1, stats.totalOrders)) * 10;
  const criticalsPer10Orders = (criticals / Math.max(1, stats.totalOrders)) * 10;
  const incidentPenalty = Math.min(100, incidentsPer10Orders * 15 + criticalsPer10Orders * 35);
  const qualityScorePct = Math.max(0, 100 - incidentPenalty);
  const qualityPoints = (qualityScorePct / 100) * 30;

  const totalScore = Math.round(otifPoints + pricePoints + qualityPoints);

  let tier: 'A' | 'B' | 'C' | 'D';
  if (totalScore >= 90) tier = 'A';
  else if (totalScore >= 75) tier = 'B';
  else if (totalScore >= 60) tier = 'C';
  else tier = 'D';

  return { score: totalScore, tier };
}

/**
 * Formats a printable 80mm / ASCII Vendor Audit Scorecard Ticket
 */
export function generateVendorScorecardTicket(params: {
  supplierName: string;
  supplierCode?: string | null;
  overallScore: number;
  ratingTier: string;
  totalOrders: number;
  otifRatePct: number;
  onTimeDeliveries: number;
  inFullDeliveries: number;
  otifDeliveries: number;
  avgPriceVariancePct: number;
  incidentsCount: number;
  brandName?: string;
  generatedDate?: Date;
}): string {
  const date = params.generatedDate || new Date();
  const dateStr = date.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const pad = (str: string, length: number, fill = ' ') => {
    return str.length >= length ? str.slice(0, length) : str + fill.repeat(length - str.length);
  };
  const center = (str: string, length: number) => {
    if (str.length >= length) return str.slice(0, length);
    const left = Math.floor((length - str.length) / 2);
    const right = length - str.length - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const line = '='.repeat(42);
  const dash = '-'.repeat(42);

  const tierDescriptions: Record<string, string> = {
    A: 'PROVEEDOR ESTRATÉGICO / EXCELENTE',
    B: 'PROVEEDOR CONFIABLE / BUENO',
    C: 'BAJO OBSERVACIÓN / RIESGO MODERADO',
    D: 'CRÍTICO / CONDICIONADO / SUSPENSIÓN',
  };

  return [
    line,
    center(params.brandName ? params.brandName.toUpperCase() : 'DARKFLOW ENTERPRISE', 42),
    center('EVALUACIÓN Y AUDITORÍA DE PROVEEDORES', 42),
    center('SCORECARD VENDOR & OTIF AUDIT', 42),
    line,
    `Fecha Impresión: ${dateStr}`,
    `Proveedor      : ${params.supplierName.toUpperCase()}`,
    params.supplierCode ? `Código         : ${params.supplierCode}` : '',
    dash,
    center('CALIFICACIÓN GENERAL Y NIVEL', 42),
    center(`TIER [ ${params.ratingTier} ] - ${params.overallScore} / 100 PTS`, 42),
    center(tierDescriptions[params.ratingTier] || 'SIN CLASIFICAR', 42),
    dash,
    center('MÉTRICAS CLAVE DE DESEMPEÑO (OTIF)', 42),
    dash,
    `${pad('Órdenes Recibidas Totales', 30)}: ${params.totalOrders}`,
    `${pad('A Tiempo (On-Time)', 30)}: ${params.onTimeDeliveries} (${params.totalOrders > 0 ? Math.round((params.onTimeDeliveries / params.totalOrders) * 100) : 100}%)`,
    `${pad('Completas (In-Full >=98%)', 30)}: ${params.inFullDeliveries} (${params.totalOrders > 0 ? Math.round((params.inFullDeliveries / params.totalOrders) * 100) : 100}%)`,
    `${pad('OTIF Consolidado', 30)}: ${params.otifDeliveries} (${params.otifRatePct.toFixed(1)}%)`,
    dash,
    center('DISCREPANCIAS DE PRECIO (PPV)', 42),
    dash,
    `${pad('Variación Media de Costos', 30)}: ${params.avgPriceVariancePct >= 0 ? '+' : ''}${params.avgPriceVariancePct.toFixed(2)}%`,
    `${pad('Cumplimiento Lista de Precios', 30)}: ${params.avgPriceVariancePct <= 0 ? 'OPTIMO (0% SOBREPRECIO)' : 'CON SOBRECOSTO'}`,
    dash,
    center('INCIDENCIAS DE CALIDAD Y RECEPCIÓN', 42),
    dash,
    `${pad('Incidencias Registradas', 30)}: ${params.incidentsCount}`,
    `${pad('Estado de Confiabilidad', 30)}: ${params.overallScore >= 75 ? 'APROBADO' : 'REQUIERE PLAN ACCIÓN'}`,
    line,
    center('AUDITORÍA DE ABASTECIMIENTO CONTINUO', 42),
    center('DOCUMENTO VÁLIDO PARA NEGOCIACIÓN', 42),
    line,
  ]
    .filter(Boolean)
    .join('\n');
}
