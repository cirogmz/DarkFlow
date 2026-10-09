/**
 * Loss Prevention & Anti-Fraud Engine (Phase 31)
 * Audits, flags, and prevents revenue leakage, post-bill print voids, unauthorized discounts, and table manipulation.
 */

import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export type SecurityIncidentType =
  | 'POST_PREBILL_CANCEL'
  | 'REOPEN_SETTLED_ORDER'
  | 'EXCESSIVE_DISCOUNT'
  | 'SUSPICIOUS_TRANSFER'
  | 'UNAUTHORIZED_VOID'
  | 'DRAWER_POP_NO_SALE';

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentStatus = 'FLAGGED' | 'UNDER_REVIEW' | 'JUSTIFIED' | 'CONFIRMED_FRAUD';

export interface SecurityIncidentInput {
  brandId: string;
  orderId?: string | null;
  type: SecurityIncidentType;
  severity?: IncidentSeverity;
  description: string;
  amountAtRisk?: number;
  userId?: string | null;
  userName?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

export const INCIDENT_TYPE_LABELS: Record<SecurityIncidentType, { label: string; desc: string }> = {
  POST_PREBILL_CANCEL: {
    label: 'Cancelación Post Pre-cuenta',
    desc: 'Comanda o platillos cancelados después de que el mesero/cajero imprimió la cuenta al comensal.',
  },
  REOPEN_SETTLED_ORDER: {
    label: 'Reapertura de Comanda Pagada',
    desc: 'Intento de modificar o reabrir una orden después de haber sido saldada o cerrada.',
  },
  EXCESSIVE_DISCOUNT: {
    label: 'Descuento Excesivo / Fuera de Rango',
    desc: 'Descuento manual aplicado que supera los umbrales de cortesía autorizados (ej. > 20%).',
  },
  SUSPICIOUS_TRANSFER: {
    label: 'Transferencia Sospechosa de Mesa',
    desc: 'Movimiento de platillos o comandas entre mesas tras haberse emitido ticket de consumo.',
  },
  UNAUTHORIZED_VOID: {
    label: 'Anulación sin Motivo Válido',
    desc: 'Anulación de orden completa sin justificación operativa o sin merma declarada.',
  },
  DRAWER_POP_NO_SALE: {
    label: 'Apertura de Cajón sin Venta',
    desc: 'Apertura física de gaveta de dinero sin transacción de venta asociada.',
  },
};

/**
 * Evaluates if a void/cancellation has high fraud risk due to prebill already being printed.
 */
export function isPostPrebillVoid(order: { prebillPrintedAt?: Date | null; prebillPrintedCount?: number }): boolean {
  return !!order.prebillPrintedAt && (order.prebillPrintedCount || 0) > 0;
}

/**
 * Evaluates whether a manual discount exceeds normal courtesy thresholds.
 * Flags as high risk if discount > 20% or amount > $200 MXN without supervisor token.
 */
export function isExcessiveDiscount(subtotal: number, discountAmount: number): boolean {
  if (subtotal <= 0 || discountAmount <= 0) return false;
  const pct = (discountAmount / subtotal) * 100;
  return pct >= 20 || discountAmount >= 200;
}

/**
 * Records an immutable security incident in the database and synchronizes with AuditLog.
 */
export async function createSecurityIncident({
  brandId,
  orderId = null,
  type,
  severity = 'HIGH',
  description,
  amountAtRisk = 0,
  userId = null,
  userName = null,
  metadata = null,
}: SecurityIncidentInput) {
  try {
    const serializedMeta = typeof metadata === 'object' && metadata !== null ? JSON.stringify(metadata) : (metadata as string | null);

    const incident = await prisma.securityIncident.create({
      data: {
        brandId,
        orderId: orderId || null,
        type,
        severity,
        description,
        amountAtRisk: Math.max(0, Number(amountAtRisk) || 0),
        userId: userId || null,
        userName: userName || null,
        status: 'FLAGGED',
        metadata: serializedMeta,
      },
    });

    // Mirror in immutable audit log
    await recordAuditLog({
      action: `FRAUD_ALERT_${type}`,
      entityType: 'SECURITY_INCIDENT',
      entityId: incident.id,
      severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      details: `🚨 Incidente Antifraude [${INCIDENT_TYPE_LABELS[type]?.label || type}]: ${description}. Monto en riesgo: $${amountAtRisk.toFixed(2)} MXN`,
      brandId,
      userId,
    });

    return incident;
  } catch (error) {
    console.error('Failed to create security incident:', error);
    return null;
  }
}

/**
 * Calculates a global Fraud Risk Index (0 - 100) and operational loss summary.
 */
export function calculateLossPreventionMetrics(
  incidents: Array<{
    severity: string;
    type: string;
    amountAtRisk: number;
    status: string;
  }>
) {
  const total = incidents.length;
  let totalAmountAtRisk = 0;
  let flaggedCount = 0;
  let confirmedFraudCount = 0;
  let postPrebillCount = 0;
  let excessiveDiscountCount = 0;

  let riskScorePoints = 0;

  for (const inc of incidents) {
    totalAmountAtRisk += inc.amountAtRisk || 0;

    if (inc.status === 'FLAGGED' || inc.status === 'UNDER_REVIEW') flaggedCount++;
    if (inc.status === 'CONFIRMED_FRAUD') confirmedFraudCount++;

    if (inc.type === 'POST_PREBILL_CANCEL') {
      postPrebillCount++;
      riskScorePoints += 25;
    } else if (inc.type === 'EXCESSIVE_DISCOUNT') {
      excessiveDiscountCount++;
      riskScorePoints += 15;
    } else if (inc.type === 'REOPEN_SETTLED_ORDER') {
      riskScorePoints += 20;
    } else {
      riskScorePoints += 10;
    }

    if (inc.severity === 'CRITICAL') riskScorePoints += 15;
    if (inc.severity === 'HIGH') riskScorePoints += 8;
  }

  // Cap score between 0 and 100
  const riskScore = Math.min(100, Math.max(0, riskScorePoints));
  const riskLevel: 'BAJO' | 'MODERADO' | 'CRÍTICO' =
    riskScore >= 60 ? 'CRÍTICO' : riskScore >= 25 ? 'MODERADO' : 'BAJO';

  return {
    totalIncidents: total,
    totalAmountAtRisk: Number(totalAmountAtRisk.toFixed(2)),
    flaggedCount,
    confirmedFraudCount,
    postPrebillCount,
    excessiveDiscountCount,
    riskScore,
    riskLevel,
  };
}
