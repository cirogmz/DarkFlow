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

    const contract = await prisma.franchiseContract.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        statements: {
          orderBy: { periodEnd: 'desc' },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // RBAC: Check ownership if partner role
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      const isOwner = contract.userId === session.userId || contract.partnerEmail === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'No tienes permiso para ver este contrato' }, { status: 403 });
      }
    }

    return NextResponse.json({ contract });
  } catch (error: any) {
    console.error('Error fetching franchise contract detail:', error);
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

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden modificar contratos' }, { status: 403 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const existing = await prisma.franchiseContract.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const {
      partnerName,
      partnerEmail,
      partnerPhone,
      partnerRfc,
      bankName,
      bankAccount,
      royaltyFeePct,
      marketingFeePct,
      techFeeMonthly,
      commissaryFeePct,
      calculationBasis,
      equitySharePct,
      minimumMonthlyFee,
      status,
      notes,
    } = body;

    const updateData: any = {};
    if (partnerName !== undefined) updateData.partnerName = partnerName.trim();
    if (partnerEmail !== undefined) updateData.partnerEmail = partnerEmail ? partnerEmail.trim() : null;
    if (partnerPhone !== undefined) updateData.partnerPhone = partnerPhone ? partnerPhone.trim() : null;
    if (partnerRfc !== undefined) updateData.partnerRfc = partnerRfc ? partnerRfc.trim().toUpperCase() : null;
    if (bankName !== undefined) updateData.bankName = bankName ? bankName.trim() : null;
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount ? bankAccount.trim() : null;
    if (royaltyFeePct !== undefined) updateData.royaltyFeePct = parseFloat(Number(royaltyFeePct).toFixed(2));
    if (marketingFeePct !== undefined) updateData.marketingFeePct = parseFloat(Number(marketingFeePct).toFixed(2));
    if (techFeeMonthly !== undefined) updateData.techFeeMonthly = parseFloat(Number(techFeeMonthly).toFixed(2));
    if (commissaryFeePct !== undefined) updateData.commissaryFeePct = parseFloat(Number(commissaryFeePct).toFixed(2));
    if (calculationBasis !== undefined) updateData.calculationBasis = calculationBasis;
    if (equitySharePct !== undefined) updateData.equitySharePct = parseFloat(Number(equitySharePct).toFixed(2));
    if (minimumMonthlyFee !== undefined) updateData.minimumMonthlyFee = parseFloat(Number(minimumMonthlyFee).toFixed(2));
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes ? String(notes).trim() : null;

    const updated = await prisma.franchiseContract.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'FRANCHISE_CONTRACT_UPDATED',
      entityType: 'FranchiseContract',
      entityId: id,
      severity: 'INFO',
      details: {
        contractFolio: updated.contractFolio,
        status: updated.status,
      },
    });

    return NextResponse.json({
      contract: updated,
      message: 'Contrato actualizado exitosamente',
    });
  } catch (error: any) {
    console.error('Error updating franchise contract:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar contrato' }, { status: 500 });
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

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar contratos' }, { status: 403 });
    }

    const activeBrandId = session.activeBrandId as string;

    const existing = await prisma.franchiseContract.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        _count: { select: { statements: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    await prisma.franchiseContract.delete({ where: { id } });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'FRANCHISE_CONTRACT_DELETED',
      entityType: 'FranchiseContract',
      entityId: id,
      severity: 'WARNING',
      details: { contractFolio: existing.contractFolio, partnerName: existing.partnerName },
    });

    return NextResponse.json({
      success: true,
      message: `Contrato ${existing.contractFolio} eliminado correctamente`,
    });
  } catch (error: any) {
    console.error('Error deleting franchise contract:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar contrato' }, { status: 500 });
  }
}
