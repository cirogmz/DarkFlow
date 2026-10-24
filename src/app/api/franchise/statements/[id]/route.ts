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

    const statement = await prisma.royaltyStatement.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        contract: true,
        brand: { select: { name: true, logoUrl: true } },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }

    // RBAC: Check ownership if partner role
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      const isOwner = statement.contract.userId === session.userId || statement.contract.partnerEmail === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'No tienes permiso para ver este estado de cuenta' }, { status: 403 });
      }
    }

    return NextResponse.json({ statement });
  } catch (error: any) {
    console.error('Error fetching statement detail:', error);
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

    const existing = await prisma.royaltyStatement.findFirst({
      where: { id, brandId: activeBrandId },
      include: { contract: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }

    // RBAC check
    if (session.role === 'FRANCHISEE' || session.role === 'INVESTOR') {
      const isOwner = existing.contract.userId === session.userId || existing.contract.partnerEmail === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'No tienes permiso para modificar este estado de cuenta' }, { status: 403 });
      }
      // Franchisees/investors can only set status to DISPUTED or add notes
      if (body.status && body.status !== 'DISPUTED') {
        return NextResponse.json({ error: 'Los socios solo pueden reportar discrepancias (DISPUTED)' }, { status: 403 });
      }
    }

    const {
      status, // ISSUED | PAID | DISPUTED | CANCELLED
      paymentMethod,
      paymentReference,
      notes,
    } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'PAID') {
        updateData.paidAt = new Date();
      }
    }
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (paymentReference !== undefined) updateData.paymentReference = paymentReference ? String(paymentReference).trim() : null;
    if (notes !== undefined) updateData.notes = notes ? String(notes).trim() : null;

    const updated = await prisma.royaltyStatement.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'ROYALTY_STATEMENT_UPDATED',
      entityType: 'RoyaltyStatement',
      entityId: id,
      severity: status === 'PAID' ? 'INFO' : 'WARNING',
      details: {
        statementFolio: updated.statementFolio,
        status: updated.status,
        totalDue: updated.totalDue,
      },
    });

    return NextResponse.json({
      statement: updated,
      message: `Estado de cuenta actualizado a: ${updated.status}`,
    });
  } catch (error: any) {
    console.error('Error updating statement:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar estado de cuenta' }, { status: 500 });
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

    const existing = await prisma.royaltyStatement.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }

    await prisma.royaltyStatement.delete({ where: { id } });

    await recordAuditLog({
      brandId: activeBrandId,
      userId: session.userId,
      action: 'ROYALTY_STATEMENT_DELETED',
      entityType: 'RoyaltyStatement',
      entityId: id,
      severity: 'WARNING',
      details: { statementFolio: existing.statementFolio },
    });

    return NextResponse.json({
      success: true,
      message: `Estado de cuenta ${existing.statementFolio} eliminado`,
    });
  } catch (error: any) {
    console.error('Error deleting statement:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar estado de cuenta' }, { status: 500 });
  }
}
