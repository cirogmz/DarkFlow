import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { generateApologyCouponCode } from '@/lib/surveys';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const {
      status,
      resolutionNotes,
      manualCompensationType, // 'WALLET_CREDIT' | 'COUPON'
      manualCompensationAmount,
    } = body;

    const existing = await prisma.satisfactionSurvey.findUnique({
      where: { id },
      include: {
        order: true,
        customer: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 });
    }

    const newStatus = status || existing.status;
    let compType = existing.compensationType;
    let compAmount = existing.compensationAmount;
    let compCouponCode = existing.compensationCouponCode;
    let compCouponId = existing.compensationCouponId;
    let compWalletTxId = existing.compensationWalletTxId;
    let compStatus = existing.compensationStatus;

    // Handle optional manual compensation granted by manager
    if (manualCompensationType === 'WALLET_CREDIT' && manualCompensationAmount > 0) {
      if (existing.customer) {
        const creditAmount = Number(manualCompensationAmount);
        const result = await prisma.$transaction(async (tx) => {
          const fresh = await tx.customer.findUniqueOrThrow({ where: { id: existing.customer!.id } });
          const balanceBefore = fresh.walletBalance;
          const balanceAfter = Number((balanceBefore + creditAmount).toFixed(2));

          await tx.customer.update({
            where: { id: fresh.id },
            data: {
              walletBalance: balanceAfter,
              totalCashbackEarned: Number((fresh.totalCashbackEarned + creditAmount).toFixed(2)),
            },
          });

          const walletTx = await tx.customerWalletTransaction.create({
            data: {
              customerId: fresh.id,
              brandId: existing.brandId,
              orderId: existing.orderId,
              type: 'REFUND_ADJUSTMENT',
              amount: creditAmount,
              balanceBefore,
              balanceAfter,
              reference: `Compensación Gerencial Comanda #${existing.order.orderNumber}`,
              notes: resolutionNotes || 'Ajuste de saldo por resolución de queja',
              createdById: session.userId,
              createdByName: session.email || 'Gerente',
            },
          });

          return { walletTx, balanceAfter };
        });

        compType = 'WALLET_CREDIT';
        compAmount = creditAmount;
        compWalletTxId = result.walletTx.id;
        compStatus = 'CLAIMED';
      }
    } else if (manualCompensationType === 'COUPON' && manualCompensationAmount > 0) {
      const discountPct = Number(manualCompensationAmount);
      const couponCode = generateApologyCouponCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const createdCoupon = await prisma.coupon.create({
        data: {
          code: couponCode,
          description: `Cupón de resolución gerencial Comanda #${existing.order.orderNumber} (${discountPct}%)`,
          discountType: 'PERCENTAGE',
          discountValue: discountPct,
          minOrderAmount: 0,
          usageLimit: 1,
          usedCount: 0,
          startDate: new Date(),
          endDate: expiresAt,
          isActive: true,
          brandId: existing.brandId,
        },
      });

      compType = 'COUPON';
      compAmount = discountPct;
      compCouponId = createdCoupon.id;
      compCouponCode = createdCoupon.code;
      compStatus = 'OFFERED';
    }

    const updated = await prisma.satisfactionSurvey.update({
      where: { id },
      data: {
        status: newStatus,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        resolvedAt: newStatus === 'RESOLVED' ? new Date() : (newStatus === 'PENDING_RESOLUTION' ? null : existing.resolvedAt),
        resolvedById: newStatus === 'RESOLVED' ? session.userId : existing.resolvedById,
        compensationType: compType,
        compensationAmount: compAmount,
        compensationCouponId: compCouponId,
        compensationCouponCode: compCouponCode,
        compensationWalletTxId: compWalletTxId,
        compensationStatus: compStatus,
        compensationClaimedAt: compStatus === 'CLAIMED' ? new Date() : existing.compensationClaimedAt,
      },
    });

    // Log recovery action to AuditLog
    if (resolutionNotes || (status && status !== existing.status) || manualCompensationType) {
      await recordAuditLog({
        action: 'CUSTOMER_RECOVERY_UPDATE',
        entityType: 'SATISFACTION_SURVEY',
        entityId: updated.id,
        severity: 'INFO',
        details: `Gestión de Queja #${existing.order.orderNumber} por ${session.email || 'gerencia'}: Estado [${newStatus}]. ${manualCompensationType ? `[Compensación: ${compType} de ${compAmount}]` : ''} ${resolutionNotes ? `Resolución: "${resolutionNotes.slice(0, 160)}"` : ''}`,
        userId: session.userId,
        brandId: existing.brandId,
        req,
      });
    }

    return NextResponse.json({ success: true, survey: updated });
  } catch (error) {
    console.error('Error updating survey resolution:', error);
    return NextResponse.json({ error: 'Error al actualizar resolución de encuesta' }, { status: 500 });
  }
}
