import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateDisputeDossier, DeliveryPlatform, DiscrepancyFinding } from '@/lib/deliveryAudit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const { settlementId } = await params;
    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download') === 'true';

    const settlement = await prisma.deliveryPayoutSettlement.findUnique({
      where: { id: settlementId },
      include: {
        brand: true,
        disputes: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    let dossier = settlement.dossierContent;

    // Si no tiene expediente pregenerado, generarlo al vuelo
    if (!dossier) {
      const discrepancies: DiscrepancyFinding[] = settlement.disputes.map((d) => {
        let evObj: any = {};
        try {
          if (d.evidence) evObj = JSON.parse(d.evidence);
        } catch {
          evObj = { evidenceText: d.evidence };
        }

        return {
          orderId: d.orderId || undefined,
          orderNumber: d.order?.orderNumber || evObj.orderNumber || d.externalOrderId || 'N/A',
          externalOrderId: d.externalOrderId || undefined,
          platform: d.platform as DeliveryPlatform,
          disputeType: d.disputeType as any,
          claimedAmount: d.claimedAmount,
          expectedValue: evObj.expectedValue || d.claimedAmount,
          reportedValue: evObj.reportedValue || 0,
          difference: d.claimedAmount,
          reason: d.reason || 'Discrepancia detectada',
          evidence: evObj.evidenceText || 'Registro de auditoría interna DarkFlow',
        };
      });

      dossier = generateDisputeDossier({
        brandName: settlement.brand.name,
        brandLegalName: settlement.brand.legalName || settlement.brand.name,
        brandRfc: settlement.brand.rfc || 'XAXX010101000',
        folio: settlement.folio,
        platform: settlement.platform as DeliveryPlatform,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
        discrepancies,
        totalClaimedAmount: settlement.totalClaimedDisputes || settlement.disputes.reduce((acc, d) => acc + d.claimedAmount, 0),
      });
    }

    if (download) {
      const filename = `expediente-reclamo-${settlement.folio}.txt`;
      return new NextResponse(dossier, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      settlementId: settlement.id,
      folio: settlement.folio,
      platform: settlement.platform,
      totalDisputes: settlement.disputes.length,
      totalClaimedDisputes: settlement.totalClaimedDisputes,
      dossierContent: dossier,
    });
  } catch (error: any) {
    console.error('Error al generar expediente de disputa:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
