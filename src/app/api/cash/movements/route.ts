import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    let targetSessionId = sessionId;

    if (!targetSessionId) {
      const activeSession = await prisma.cashSession.findFirst({
        where: { brandId: session.activeBrandId, status: 'OPEN' },
      });
      if (!activeSession) {
        return NextResponse.json({ movements: [] });
      }
      targetSessionId = activeSession.id;
    }

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: targetSessionId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ movements });
  } catch (error) {
    console.error('Error fetching cash movements:', error);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
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
    const { type, amount, reason, category } = body;

    if (!type || (type !== 'IN' && type !== 'OUT')) {
      return NextResponse.json({ error: 'Tipo de movimiento inválido (debe ser IN u OUT)' }, { status: 400 });
    }

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un número positivo mayor a 0' }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'El motivo del movimiento es obligatorio' }, { status: 400 });
    }

    // Find active session
    const activeSession = await prisma.cashSession.findFirst({
      where: {
        brandId: activeBrandId,
        status: 'OPEN',
      },
    });

    if (!activeSession) {
      return NextResponse.json({ error: 'No hay un turno de caja abierto para registrar movimientos' }, { status: 400 });
    }

    // Execute within transaction
    const movement = await prisma.$transaction(async (tx) => {
      const newMovement = await tx.cashMovement.create({
        data: {
          cashSessionId: activeSession.id,
          type,
          amount: parsedAmount,
          reason: reason.trim(),
          category: category || (type === 'IN' ? 'CHANGE_FLOAT' : 'EXPENSE'),
          createdById: session.userId,
          createdByName: session.name,
        },
      });

      if (type === 'IN') {
        await tx.cashSession.update({
          where: { id: activeSession.id },
          data: { cashInTotal: { increment: parsedAmount } },
        });
      } else {
        await tx.cashSession.update({
          where: { id: activeSession.id },
          data: { cashOutTotal: { increment: parsedAmount } },
        });
      }

      return newMovement;
    });

    await recordAuditLog({
      action: type === 'IN' ? 'CASH_INFLOW_RECORDED' : 'CASH_OUTFLOW_RECORDED',
      entityType: 'CASH_MOVEMENT',
      entityId: movement.id,
      details: {
        type,
        amount: parsedAmount,
        reason,
        category,
        sessionId: activeSession.id,
      },
      severity: parsedAmount >= 1000 ? 'WARNING' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, movement });
  } catch (error) {
    console.error('Error creating cash movement:', error);
    return NextResponse.json({ error: 'Error al registrar movimiento de efectivo' }, { status: 500 });
  }
}
