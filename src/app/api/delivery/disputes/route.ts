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
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');

    const whereClause: any = { brandId: activeBrandId };
    if (platform && platform !== 'ALL') whereClause.platform = platform;
    if (status && status !== 'ALL') whereClause.status = status;

    const disputes = await prisma.deliveryDispute.findMany({
      where: whereClause,
      include: {
        settlement: {
          select: {
            folio: true,
            platform: true,
            periodStart: true,
            periodEnd: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
            externalOrderId: true,
            total: true,
            customerName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalClaimed = 0;
    let totalRecovered = 0;
    let openCount = 0;

    for (const d of disputes) {
      totalClaimed += d.claimedAmount;
      totalRecovered += d.recoveredAmount;
      if (d.status === 'OPEN' || d.status === 'SUBMITTED_TO_APP') {
        openCount++;
      }
    }

    return NextResponse.json({
      disputes,
      metrics: {
        totalDisputes: disputes.length,
        openDisputes: openCount,
        totalClaimed: parseFloat(totalClaimed.toFixed(2)),
        totalRecovered: parseFloat(totalRecovered.toFixed(2)),
        recoveryRate: totalClaimed > 0 ? parseFloat(((totalRecovered / totalClaimed) * 100).toFixed(1)) : 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching delivery disputes:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
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
      settlementId,
      orderId,
      platform,
      externalOrderId,
      disputeType, // UNPAID_ORDER | WRONGFUL_REFUND | COMMISSION_OVERCHARGE | CANCELLED_WITHOUT_PAYOUT
      claimedAmount,
      ticketFolio,
      reason,
    } = body;

    if (!platform || !claimedAmount || !reason) {
      return NextResponse.json({ error: 'Plataforma, monto reclamado y motivo son requeridos' }, { status: 400 });
    }

    const dispute = await prisma.deliveryDispute.create({
      data: {
        brandId: activeBrandId,
        settlementId: settlementId || null,
        orderId: orderId || null,
        platform,
        externalOrderId: externalOrderId ? String(externalOrderId).trim() : null,
        disputeType: disputeType || 'UNPAID_ORDER',
        claimedAmount: parseFloat(Number(claimedAmount).toFixed(2)),
        status: 'OPEN',
        ticketFolio: ticketFolio ? String(ticketFolio).trim() : `TICK-${Date.now().toString().slice(-6)}`,
        reason: String(reason).trim(),
        createdById: session.userId,
        createdByName: session.name,
      },
    });

    // If order linked, mark its status as DISPUTED
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { reconciliationStatus: 'DISPUTED' },
      });
    }

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'DELIVERY_DISPUTE_OPENED',
      entityType: 'DeliveryDispute',
      entityId: dispute.id,
      severity: 'WARNING',
      details: {
        platform,
        claimedAmount,
        ticketFolio: dispute.ticketFolio,
        disputeType: dispute.disputeType,
      },
    });

    return NextResponse.json({
      dispute,
      message: `Disputa ${dispute.ticketFolio} registrada exitosamente`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delivery dispute:', error);
    return NextResponse.json({ error: error.message || 'Error interno al registrar disputa' }, { status: 500 });
  }
}
