import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';
import { createInternalRequisition } from '@/lib/requisitions';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const where: any = { brandId: session.activeBrandId };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (type && type !== 'ALL') {
      where.type = type;
    }

    const requisitions = await prisma.internalRequisition.findMany({
      where,
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
        dispatchedBy: { select: { id: true, name: true, role: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(requisitions);
  } catch (error: any) {
    console.error('Error fetching internal requisitions:', error);
    return NextResponse.json(
      { error: 'Error al consultar requisiciones', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const requisition = await createInternalRequisition(
      session.activeBrandId,
      session.userId,
      body
    );

    // Auditoría
    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'INTERNAL_REQUISITION_CREATED',
      entityType: 'REQUISITION',
      entityId: requisition.id,
      severity: 'INFO',
      details: `Requisición ${requisition.folio} (${requisition.type}) creada con ${requisition.items.length} insumos por valor estimado de $${requisition.totalEstimatedCost.toFixed(2)}.`,
      req,
    });

    return NextResponse.json(requisition, { status: 201 });
  } catch (error: any) {
    console.error('Error creating internal requisition:', error);
    return NextResponse.json(
      { error: 'Error al registrar requisición', details: error.message },
      { status: 500 }
    );
  }
}
