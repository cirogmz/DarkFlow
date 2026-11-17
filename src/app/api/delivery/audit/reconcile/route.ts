import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  reconcileStatementWithOrders,
  generateDisputeDossier,
  DeliveryPlatform,
} from '@/lib/deliveryAudit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandId,
      platform,
      statementRows,
      bankDepositAmount,
      saveSettlement = false,
      notes,
      statementFileName,
      periodStart,
      periodEnd,
    } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId es requerido' }, { status: 400 });
    }

    if (!statementRows || !Array.isArray(statementRows) || statementRows.length === 0) {
      return NextResponse.json({ error: 'statementRows debe ser un array con al menos 1 fila' }, { status: 400 });
    }

    const auditResult = await reconcileStatementWithOrders({
      brandId,
      platform: platform as DeliveryPlatform,
      statementRows,
      bankDepositAmount: bankDepositAmount ? parseFloat(bankDepositAmount) : 0,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
    });

    // Si solo es previsualización, retornar análisis directamente
    if (!saveSettlement) {
      return NextResponse.json({
        preview: true,
        ...auditResult,
      });
    }

    // 2. Si se solicita guardar, registrar Liquidación y Disputas en BD
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    const yearWeek = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const folio = `SETTLE-${platform}-${yearWeek}-${rand}`;

    const dossier = generateDisputeDossier({
      brandName: brand?.name || 'Restaurante',
      brandLegalName: brand?.legalName || brand?.name || 'Comercio Aliado SA de CV',
      brandRfc: brand?.rfc || 'XAXX010101000',
      folio,
      platform: platform as DeliveryPlatform,
      periodStart: auditResult.periodStart,
      periodEnd: auditResult.periodEnd,
      discrepancies: auditResult.discrepancies,
      totalClaimedAmount: auditResult.totalClaimedDisputes,
    });

    const status = auditResult.discrepancies.length > 0 ? 'DISCREPANCY' : 'RECONCILED';

    const saved = await prisma.$transaction(async (tx) => {
      const createdSettlement = await tx.deliveryPayoutSettlement.create({
        data: {
          brandId,
          platform,
          folio,
          periodStart: auditResult.periodStart,
          periodEnd: auditResult.periodEnd,
          bankDepositAmount: auditResult.bankDepositAmount,
          status,
          ordersCount: auditResult.ordersCount,
          grossSales: auditResult.grossSales,
          platformCommission: auditResult.platformCommission,
          commissionTax: auditResult.commissionTax,
          withholdingIsr: auditResult.withholdingIsr,
          withholdingIva: auditResult.withholdingIva,
          promotionsFunded: auditResult.promotionsFunded,
          adjustmentsRefunds: auditResult.adjustmentsRefunds,
          netPayoutCalculated: auditResult.netPayoutCalculated,
          variance: auditResult.variance,
          notes: notes || null,
          statementFileName: statementFileName || null,
          dossierGeneratedAt: auditResult.discrepancies.length > 0 ? new Date() : null,
          dossierContent: auditResult.discrepancies.length > 0 ? dossier : null,
          totalClaimedDisputes: auditResult.totalClaimedDisputes,
          totalRecoveredDisputes: 0,
        },
      });

      // Registrar disputas individuales
      for (const d of auditResult.discrepancies) {
        await tx.deliveryDispute.create({
          data: {
            brandId,
            settlementId: createdSettlement.id,
            orderId: d.orderId || null,
            platform,
            externalOrderId: d.externalOrderId || null,
            disputeType: d.disputeType,
            claimedAmount: d.claimedAmount,
            recoveredAmount: 0,
            status: 'OPEN',
            reason: d.reason,
            evidence: JSON.stringify({
              evidenceText: d.evidence,
              orderNumber: d.orderNumber,
              reportedValue: d.reportedValue,
              expectedValue: d.expectedValue,
            }),
          },
        });
      }

      return createdSettlement;
    });

    return NextResponse.json({
      success: true,
      settlementId: saved.id,
      folio: saved.folio,
      status: saved.status,
      auditResult,
      dossier,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error al conciliar estado de cuenta delivery:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
