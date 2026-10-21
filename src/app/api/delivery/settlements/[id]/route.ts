import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const settlement = await prisma.deliveryPayoutSettlement.findFirst({
      where: {
        id,
        brandId: activeBrandId,
      },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            externalOrderId: true,
            customerName: true,
            customerPhone: true,
            total: true,
            subtotal: true,
            tax: true,
            platformCommissionRate: true,
            platformCommission: true,
            netPayout: true,
            status: true,
            createdAt: true,
            reconciliationStatus: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        disputes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ settlement });
  } catch (error: any) {
    console.error('Error fetching settlement details:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const existing = await prisma.deliveryPayoutSettlement.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const {
      status,
      bankDepositAmount,
      bankReference,
      bankDepositDate,
      notes,
    } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (bankReference !== undefined) updateData.bankReference = bankReference;
    if (bankDepositDate) updateData.bankDepositDate = new Date(bankDepositDate);
    if (notes !== undefined) updateData.notes = notes;

    if (bankDepositAmount !== undefined) {
      const deposit = parseFloat(Number(bankDepositAmount).toFixed(2));
      updateData.bankDepositAmount = deposit;
      const variance = parseFloat((deposit - existing.netPayoutCalculated).toFixed(2));
      updateData.variance = variance;
      if (Math.abs(variance) <= 1.0) {
        updateData.status = 'RECONCILED';
      } else {
        updateData.status = 'DISCREPANCY';
      }
    }

    updateData.reconciledById = session.userId;
    updateData.reconciledByName = session.name;
    updateData.reconciledAt = new Date();

    const updated = await prisma.deliveryPayoutSettlement.update({
      where: { id },
      data: updateData,
    });

    // If status became RECONCILED, update linked orders
    if (updated.status === 'RECONCILED') {
      await prisma.order.updateMany({
        where: { payoutSettlementId: id },
        data: { reconciliationStatus: 'RECONCILED' },
      });
    }

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'DELIVERY_PAYOUT_SETTLEMENT_UPDATED',
      entityType: 'DeliveryPayoutSettlement',
      entityId: id,
      severity: updated.status === 'RECONCILED' ? 'INFO' : 'WARNING',
      details: {
        folio: updated.folio,
        status: updated.status,
        variance: updated.variance,
        bankDepositAmount: updated.bankDepositAmount,
      },
    });

    return NextResponse.json({
      settlement: updated,
      message: 'Liquidación actualizada correctamente',
    });
  } catch (error: any) {
    console.error('Error updating settlement:', error);
    return NextResponse.json({ error: error.message || 'Error interno al actualizar liquidación' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const existing = await prisma.deliveryPayoutSettlement.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Unlink all orders
      await tx.order.updateMany({
        where: { payoutSettlementId: id },
        data: {
          payoutSettlementId: null,
          reconciliationStatus: 'UNRECONCILED',
        },
      });

      // Delete disputes
      await tx.deliveryDispute.deleteMany({
        where: { settlementId: id },
      });

      // Delete settlement
      await tx.deliveryPayoutSettlement.delete({
        where: { id },
      });
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'DELIVERY_PAYOUT_SETTLEMENT_DELETED',
      entityType: 'DeliveryPayoutSettlement',
      entityId: id,
      severity: 'WARNING',
      details: { folio: existing.folio, platform: existing.platform },
    });

    return NextResponse.json({
      success: true,
      message: `Liquidación ${existing.folio} eliminada y pedidos restaurados a estado no conciliado`,
    });
  } catch (error: any) {
    console.error('Error deleting settlement:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar liquidación' }, { status: 500 });
  }
}
