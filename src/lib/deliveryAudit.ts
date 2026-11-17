import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

export type DeliveryPlatform = 'UBER_EATS' | 'RAPPI' | 'DIDI_FOOD';

export type DiscrepancyType =
  | 'UNPAID_ORDER'
  | 'COMMISSION_OVERCHARGE'
  | 'WRONGFUL_REFUND'
  | 'CANCELLED_WITHOUT_PAYOUT'
  | 'WRONG_TAX'
  | 'OTHER';

export interface ParsedStatementRow {
  externalOrderId: string;
  orderNumber?: string;
  date: string;
  grossAmount: number;
  commissionRate: number; // e.g. 22% = 22
  commissionAmount: number;
  taxOnCommission: number;
  withholdingIsr: number;
  withholdingIva: number;
  promotions: number;
  adjustments: number; // reembolsos o penalizaciones
  netPayout: number;
  status: string; // COMPLETED, CANCELLED, REFUNDED, etc.
  notes?: string;
}

export interface DiscrepancyFinding {
  orderId?: string;
  orderNumber: string;
  externalOrderId?: string;
  platform: DeliveryPlatform;
  disputeType: DiscrepancyType;
  claimedAmount: number;
  expectedValue: number;
  reportedValue: number;
  difference: number;
  reason: string;
  evidence: string;
}

export interface ReconciliationResult {
  platform: DeliveryPlatform;
  periodStart: Date;
  periodEnd: Date;
  ordersCount: number;
  matchedCount: number;
  unmatchedCount: number;
  grossSales: number;
  platformCommission: number;
  commissionTax: number;
  withholdingIsr: number;
  withholdingIva: number;
  promotionsFunded: number;
  adjustmentsRefunds: number;
  netPayoutCalculated: number;
  bankDepositAmount: number;
  variance: number;
  discrepancies: DiscrepancyFinding[];
  totalClaimedDisputes: number;
  summaryByType: Record<DiscrepancyType, { count: number; total: number }>;
}

/**
 * Normaliza valores numéricos desde texto de estados de cuenta (elimina $, comas, %, espacios)
 */
export function cleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[$€\s,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Number(num.toFixed(2));
}

/**
 * Detecta la plataforma de delivery basándose en las columnas del archivo
 */
export function detectPlatformFromHeaders(headerLine: string): DeliveryPlatform {
  const lower = headerLine.toLowerCase();
  if (lower.includes('uber') || lower.includes('eats') || lower.includes('restaurant payout')) {
    return 'UBER_EATS';
  }
  if (lower.includes('rappi') || lower.includes('disparador') || lower.includes('aliado')) {
    return 'RAPPI';
  }
  if (lower.includes('didi') || lower.includes('didi food')) {
    return 'DIDI_FOOD';
  }
  return 'UBER_EATS';
}

/**
 * Parsea el contenido CSV / TSV de un estado de cuenta emitido por una app de delivery
 */
export function parseDeliveryStatement(content: string, forcedPlatform?: DeliveryPlatform): {
  platform: DeliveryPlatform;
  rows: ParsedStatementRow[];
} {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('El archivo no contiene suficientes filas para ser procesado.');
  }

  // Detectar separador (, o ; o \t)
  const headerLine = lines[0];
  const sep = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';
  const headers = headerLine.split(sep).map((h) => h.replace(/["']/g, '').trim().toLowerCase());

  const platform = forcedPlatform || detectPlatformFromHeaders(headerLine);

  const rows: ParsedStatementRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Respetar comas dentro de comillas si las hay
    const regex = new RegExp(`(?:^|${sep})(\"(?:[^\"]+|\"\")*\"|[^${sep}]*)`, 'g');
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      let val = match[1];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      cols.push(val.trim());
    }

    if (cols.length < 3) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cols[idx] || '';
    });

    // Mapeo flexible por nombres de columnas comunes
    const extId =
      rowObj['order id'] ||
      rowObj['order_id'] ||
      rowObj['id orden'] ||
      rowObj['id_orden'] ||
      rowObj['numero de pedido'] ||
      rowObj['folio'] ||
      rowObj['external_id'] ||
      cols[0] ||
      `EXT-${i}`;

    const dateStr =
      rowObj['date'] ||
      rowObj['fecha'] ||
      rowObj['order_date'] ||
      rowObj['fecha creacion'] ||
      cols[1] ||
      new Date().toISOString();

    const gross = cleanNumber(
      rowObj['gross sales'] ||
      rowObj['gross_amount'] ||
      rowObj['venta bruta'] ||
      rowObj['subtotal'] ||
      rowObj['monto venta'] ||
      cols[2]
    );

    const commRate = cleanNumber(
      rowObj['commission rate'] ||
      rowObj['commission_rate'] ||
      rowObj['tasa comision'] ||
      rowObj['% comision'] ||
      0
    );

    let commAmount = Math.abs(cleanNumber(
      rowObj['platform fee'] ||
      rowObj['commission'] ||
      rowObj['comision'] ||
      rowObj['comision rappi'] ||
      rowObj['cuota de servicio'] ||
      cols[3]
    ));

    if (commAmount === 0 && commRate > 0 && gross > 0) {
      commAmount = Number((gross * (commRate / 100)).toFixed(2));
    }

    const taxComm = Math.abs(cleanNumber(
      rowObj['tax on fee'] ||
      rowObj['iva comision'] ||
      rowObj['iva_comision'] ||
      (commAmount > 0 ? Number((commAmount * 0.16).toFixed(2)) : 0)
    ));

    const isr = Math.abs(cleanNumber(rowObj['retencion isr'] || rowObj['isr'] || rowObj['withholding_isr'] || 0));
    const iva = Math.abs(cleanNumber(rowObj['retencion iva'] || rowObj['iva'] || rowObj['withholding_iva'] || 0));
    const promo = Math.abs(cleanNumber(rowObj['promotions'] || rowObj['descuentos tienda'] || rowObj['promo'] || rowObj['promociones'] || 0));
    const adj = Math.abs(cleanNumber(rowObj['adjustments'] || rowObj['reembolsos'] || rowObj['ajustes'] || rowObj['refunds'] || rowObj['other payments'] || rowObj['otros pagos'] || rowObj['ajuste'] || 0));

    let net = cleanNumber(
      rowObj['net payout'] ||
      rowObj['net_payout'] ||
      rowObj['pago neto'] ||
      rowObj['total pagado'] ||
      cols[cols.length - 1]
    );

    if (net === 0 && gross > 0) {
      net = Number((gross - commAmount - taxComm - isr - iva - promo - adj).toFixed(2));
    }

    const status = (
      rowObj['status'] ||
      rowObj['estatus'] ||
      rowObj['estado'] ||
      'COMPLETED'
    ).toUpperCase();

    rows.push({
      externalOrderId: extId.replace(/^#/, ''),
      date: dateStr,
      grossAmount: gross,
      commissionRate: commRate,
      commissionAmount: commAmount,
      taxOnCommission: taxComm,
      withholdingIsr: isr,
      withholdingIva: iva,
      promotions: promo,
      adjustments: adj,
      netPayout: net,
      status,
    });
  }

  return { platform, rows };
}

/**
 * Compara y concilia el estado de cuenta importado contra las órdenes reales de DarkFlow
 */
export async function reconcileStatementWithOrders(params: {
  brandId: string;
  platform: DeliveryPlatform;
  statementRows: ParsedStatementRow[];
  bankDepositAmount?: number;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<ReconciliationResult> {
  const { brandId, platform, statementRows, bankDepositAmount = 0 } = params;

  // 1. Obtener la marca y las tasas acordadas
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!brand) {
    throw new Error('Configuración de marca no encontrada');
  }

  const agreedCommissionRate =
    platform === 'UBER_EATS'
      ? (brand.uberCommissionRate ?? 22.0)
      : platform === 'RAPPI'
      ? (brand.rappiCommissionRate ?? 20.0)
      : (brand.didiCommissionRate ?? 18.0);

  // 2. Determinar rango de fechas
  let minDate = params.periodStart;
  let maxDate = params.periodEnd;

  if (!minDate || !maxDate) {
    const dates = statementRows
      .map((r) => new Date(r.date))
      .filter((d) => !isNaN(d.getTime()));

    if (dates.length > 0) {
      minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    } else {
      minDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      maxDate = new Date();
    }
  }

  // 3. Buscar órdenes de la plataforma en la BD de DarkFlow
  const internalOrders = await prisma.order.findMany({
    where: {
      brandId,
      createdAt: {
        gte: new Date(new Date(minDate).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(maxDate).setHours(23, 59, 59, 999)),
      },
    },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  // Mapear órdenes internas por externalOrderId y orderNumber
  const ordersByExtId = new Map<string, typeof internalOrders[0]>();
  const ordersByNum = new Map<string, typeof internalOrders[0]>();

  for (const o of internalOrders) {
    if (o.externalOrderId) {
      ordersByExtId.set(o.externalOrderId.toLowerCase(), o);
      ordersByExtId.set(o.externalOrderId.replace(/[^A-Za-z0-9]/g, '').toLowerCase(), o);
    }
    ordersByNum.set(o.orderNumber.toLowerCase(), o);
    ordersByNum.set(o.orderNumber.replace(/[^A-Za-z0-9]/g, '').toLowerCase(), o);
  }

  // 4. Procesar discrepancias y conciliación línea por línea
  const discrepancies: DiscrepancyFinding[] = [];
  const matchedOrderIds = new Set<string>();

  let grossSales = 0;
  let platformCommission = 0;
  let commissionTax = 0;
  let withholdingIsr = 0;
  let withholdingIva = 0;
  let promotionsFunded = 0;
  let adjustmentsRefunds = 0;
  let netPayoutCalculated = 0;

  for (const row of statementRows) {
    grossSales += row.grossAmount;
    platformCommission += row.commissionAmount;
    commissionTax += row.taxOnCommission;
    withholdingIsr += row.withholdingIsr;
    withholdingIva += row.withholdingIva;
    promotionsFunded += row.promotions;
    adjustmentsRefunds += row.adjustments;
    netPayoutCalculated += row.netPayout;

    // Buscar match en órdenes internas
    const cleanExtId = row.externalOrderId.toLowerCase().replace(/[^A-Za-z0-9]/g, '');
    const matched =
      ordersByExtId.get(row.externalOrderId.toLowerCase()) ||
      ordersByExtId.get(cleanExtId) ||
      ordersByNum.get(row.externalOrderId.toLowerCase()) ||
      ordersByNum.get(cleanExtId);

    if (matched) {
      matchedOrderIds.add(matched.id);

      // Regla A: Cobro de comisión en exceso (COMMISSION_OVERCHARGE)
      const chargedRate = row.commissionRate > 0
        ? row.commissionRate
        : row.grossAmount > 0
        ? Number(((row.commissionAmount / row.grossAmount) * 100).toFixed(2))
        : agreedCommissionRate;

      if (chargedRate > agreedCommissionRate + 0.5) {
        const expectedComm = Number((row.grossAmount * (agreedCommissionRate / 100)).toFixed(2));
        const diff = Number((row.commissionAmount - expectedComm).toFixed(2));
        if (diff > 1.0) {
          discrepancies.push({
            orderId: matched.id,
            orderNumber: matched.orderNumber,
            externalOrderId: row.externalOrderId,
            platform,
            disputeType: 'COMMISSION_OVERCHARGE',
            claimedAmount: diff,
            expectedValue: expectedComm,
            reportedValue: row.commissionAmount,
            difference: diff,
            reason: `Comisión cobrada del ${chargedRate}% excede la tasa contractual pactada del ${agreedCommissionRate}%.`,
            evidence: `Orden #${matched.orderNumber} ($${matched.total.toFixed(2)} MXN). Tasa pactada: ${agreedCommissionRate}%, cobrada: ${chargedRate}%.`,
          });
        }
      }

      // Regla B: Reembolsos unilaterales o penalizaciones injustificadas (WRONGFUL_REFUND)
      if (row.adjustments > 0) {
        discrepancies.push({
          orderId: matched.id,
          orderNumber: matched.orderNumber,
          externalOrderId: row.externalOrderId,
          platform,
          disputeType: 'WRONGFUL_REFUND',
          claimedAmount: row.adjustments,
          expectedValue: 0,
          reportedValue: row.adjustments,
          difference: row.adjustments,
          reason: `Descuento/reembolso unilateral no autorizado de $${row.adjustments.toFixed(2)} MXN aplicado a la comanda.`,
          evidence: `La orden fue despachada en tiempo y forma en cocina (Estatus POS: ${matched.status}). Sin reporte de falla en empaque.`,
        });
      }

      // Regla C: Pedido cancelado en camino que debió pagarse (CANCELLED_WITHOUT_PAYOUT)
      if (row.status.includes('CANCEL') && row.netPayout <= 0) {
        discrepancies.push({
          orderId: matched.id,
          orderNumber: matched.orderNumber,
          externalOrderId: row.externalOrderId,
          platform,
          disputeType: 'CANCELLED_WITHOUT_PAYOUT',
          claimedAmount: matched.subtotal,
          expectedValue: matched.subtotal,
          reportedValue: 0,
          difference: matched.subtotal,
          reason: 'Pedido cancelado por el cliente/repartidor después de ser cocinado y empacado.',
          evidence: `Insumos consumidos en cocina con valor de $${matched.subtotal.toFixed(2)} MXN. Aplica garantía de cobro según términos comerciales.`,
        });
      }
    }
  }

  // Regla D: Pedidos entregados en DarkFlow pero no liquidados en el archivo (UNPAID_ORDER)
  for (const o of internalOrders) {
    const isPlatformOrder =
      o.deliveryService?.toUpperCase() === platform ||
      o.source?.toUpperCase() === platform;

    if (isPlatformOrder && (o.status === 'DELIVERED' || o.status === 'READY') && !matchedOrderIds.has(o.id)) {
      discrepancies.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        externalOrderId: o.externalOrderId || undefined,
        platform,
        disputeType: 'UNPAID_ORDER',
        claimedAmount: o.total,
        expectedValue: o.total,
        reportedValue: 0,
        difference: o.total,
        reason: `Pedido #${o.orderNumber} despachado exitosamente en tienda pero ausente en el estado de cuenta de la plataforma.`,
        evidence: `Fecha creación: ${o.createdAt.toLocaleString('es-MX')}, Total: $${o.total.toFixed(2)} MXN, Cliente: ${o.customerName || 'N/A'}.`,
      });
    }
  }

  // Redondeos finales
  grossSales = Number(grossSales.toFixed(2));
  platformCommission = Number(platformCommission.toFixed(2));
  commissionTax = Number(commissionTax.toFixed(2));
  withholdingIsr = Number(withholdingIsr.toFixed(2));
  withholdingIva = Number(withholdingIva.toFixed(2));
  promotionsFunded = Number(promotionsFunded.toFixed(2));
  adjustmentsRefunds = Number(adjustmentsRefunds.toFixed(2));
  netPayoutCalculated = Number(netPayoutCalculated.toFixed(2));
  const finalDeposit = Number(bankDepositAmount.toFixed(2));
  const variance = Number((finalDeposit - netPayoutCalculated).toFixed(2));

  const totalClaimedDisputes = Number(
    discrepancies.reduce((acc, d) => acc + d.claimedAmount, 0).toFixed(2)
  );

  const summaryByType: Record<DiscrepancyType, { count: number; total: number }> = {
    UNPAID_ORDER: { count: 0, total: 0 },
    COMMISSION_OVERCHARGE: { count: 0, total: 0 },
    WRONGFUL_REFUND: { count: 0, total: 0 },
    CANCELLED_WITHOUT_PAYOUT: { count: 0, total: 0 },
    WRONG_TAX: { count: 0, total: 0 },
    OTHER: { count: 0, total: 0 },
  };

  for (const d of discrepancies) {
    if (!summaryByType[d.disputeType]) {
      summaryByType[d.disputeType] = { count: 0, total: 0 };
    }
    summaryByType[d.disputeType].count += 1;
    summaryByType[d.disputeType].total = Number(
      (summaryByType[d.disputeType].total + d.claimedAmount).toFixed(2)
    );
  }

  return {
    platform,
    periodStart: minDate,
    periodEnd: maxDate,
    ordersCount: statementRows.length,
    matchedCount: matchedOrderIds.size,
    unmatchedCount: statementRows.length - matchedOrderIds.size,
    grossSales,
    platformCommission,
    commissionTax,
    withholdingIsr,
    withholdingIva,
    promotionsFunded,
    adjustmentsRefunds,
    netPayoutCalculated,
    bankDepositAmount: finalDeposit,
    variance,
    discrepancies,
    totalClaimedDisputes,
    summaryByType,
  };
}

/**
 * Genera el documento formal de Reclamación / Expediente de Disputa (Claim Dossier)
 * listo para enviar a soporte técnico de Uber Eats, Rappi o DiDi Food
 */
export function generateDisputeDossier(params: {
  brandName: string;
  brandLegalName?: string;
  brandRfc?: string;
  folio: string;
  platform: DeliveryPlatform;
  periodStart: Date;
  periodEnd: Date;
  discrepancies: DiscrepancyFinding[];
  totalClaimedAmount: number;
}): string {
  const {
    brandName,
    brandLegalName = brandName,
    brandRfc = 'RFC-PENDIENTE',
    folio,
    platform,
    periodStart,
    periodEnd,
    discrepancies,
    totalClaimedAmount,
  } = params;

  const dateFmt = (d: Date) => d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const platformName = platform === 'UBER_EATS' ? 'Uber Eats' : platform === 'RAPPI' ? 'Rappi' : 'DiDi Food';

  let dossier = `
================================================================================
EXPEDIENTE FORMAL DE DISPUTA Y SOLICITUD DE REEMBOLSO
PORTAL DE AUDITORÍA Y CONCILIACIÓN DE DELIVERY - DARKFLOW
================================================================================

FOLIO DE DISPUTA:   ${folio}
PLATAFORMA:         ${platformName.toUpperCase()}
RESTAURANTE / RAZÓN: ${brandLegalName} (${brandName})
RFC EMISOR:         ${brandRfc}
PERIODO AUDITADO:   ${dateFmt(periodStart)} al ${dateFmt(periodEnd)}
MONTO TOTAL EXIGIDO: $${totalClaimedAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
FECHA DE EMISIÓN:   ${dateFmt(new Date())}

--------------------------------------------------------------------------------
1. RESUMEN EJECUTIVO DE DISCREPANCIAS
--------------------------------------------------------------------------------
Por medio del presente documento, ${brandLegalName} formaliza una reclamación por
discrepancias financieras detectadas durante la conciliación automatizada pedido
a pedido correspondiente al periodo indicado.

Se exige la restitución inmediata del saldo retenido o debitado indebidamente
por un importe neto de $${totalClaimedAmount.toFixed(2)} MXN, integrado por ${discrepancies.length} anomalías.

--------------------------------------------------------------------------------
2. DESGLOSE DETALLADO DE COMANDAS EN RECLAMACIÓN
--------------------------------------------------------------------------------
`;

  let idx = 1;
  for (const d of discrepancies) {
    const typeLabel =
      d.disputeType === 'COMMISSION_OVERCHARGE'
        ? 'SOBRECOBRO DE COMISIÓN'
        : d.disputeType === 'UNPAID_ORDER'
        ? 'PEDIDO NO LIQUIDADO / OMITIDO'
        : d.disputeType === 'WRONGFUL_REFUND'
        ? 'REEMBOLSO UNILATERAL INJUSTIFICADO'
        : d.disputeType === 'CANCELLED_WITHOUT_PAYOUT'
        ? 'CANCELACIÓN SIN PAGO DE ALIMENTOS'
        : 'DISCREPANCIA FISCAL / RETENCIÓN';

    dossier += `
CASO #${idx++}: ${typeLabel}
--------------------------------------------------------------------------------
• Pedido Interno DarkFlow: #${d.orderNumber}
• Identificador Plataforma: ${d.externalOrderId || 'N/A'}
• Importe Reclamado:       $${d.claimedAmount.toFixed(2)} MXN
• Importe Reportado App:   $${d.reportedValue.toFixed(2)} MXN
• Importe Esperado/Pactado: $${d.expectedValue.toFixed(2)} MXN
• Motivo de Inconformidad: ${d.reason}
• Evidencia de Operación:  ${d.evidence}
`;
  }

  dossier += `
--------------------------------------------------------------------------------
3. FUNDAMENTO CONTRACTUAL Y TÉRMINOS COMERCIALES
--------------------------------------------------------------------------------
1. Cumplimiento de Preparación: Cada comanda detallada cuenta con registro digital
   en la estación de cocina (KDS) y empaque con sellos inviolables de seguridad.
2. Invalidez de Reembolsos Unilaterales: Los términos comerciales estipulan que
   cualquier reclamo por calidad o entrega tardía imputable al repartidor no debe
   afectar la liquidación neta del comercio aliado.
3. Respeto a la Tasa de Comisión: Cualquier cobro de tarifa de servicio que exceda
   el porcentaje firmado en el contrato marco constituye un cobro indebido.

--------------------------------------------------------------------------------
4. PETICIÓN Y DISPERSIÓN
--------------------------------------------------------------------------------
Solicitamos la revisión del presente expediente y la acreditación del saldo a favor
en la próxima transferencia interbancaria (SPEI).

Atentamente,

________________________________________
Dirección de Administración y Finanzas
${brandLegalName}
DarkFlow Delivery Audit Engine v1.60
================================================================================
`.trim();

  return dossier;
}
