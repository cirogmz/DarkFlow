import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { calculateSupplierRating } from '@/lib/vendorScorecard';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;

    const incidents = await prisma.supplierDeliveryIncident.findMany({
      where: { brandId: activeBrandId, supplierId: id },
      include: {
        purchaseOrder: {
          select: { id: true, folio: true, expectedDate: true, receivedDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, incidents });
  } catch (error: unknown) {
    console.error('Error fetching supplier incidents:', error);
    return NextResponse.json({ error: 'Error al obtener incidencias' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      purchaseOrderId,
      incidentType,
      severity = 'MEDIUM',
      description,
      quantityAffected = 0,
      financialImpact = 0,
      resolution = 'PENDING',
      reportedByName,
    } = body;

    if (!incidentType || !description) {
      return NextResponse.json(
        { error: 'Tipo de incidencia y descripción son obligatorios' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const incident = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierDeliveryIncident.create({
        data: {
          brandId: activeBrandId,
          supplierId: id,
          purchaseOrderId: purchaseOrderId || null,
          incidentType,
          severity,
          description: description.trim(),
          quantityAffected: parseFloat(String(quantityAffected)) || 0,
          financialImpact: parseFloat(String(financialImpact)) || 0,
          resolution,
          reportedByName: reportedByName?.trim() || session.name || 'Usuario',
        },
      });

      // Recalculate supplier rating
      const allIncidents = await tx.supplierDeliveryIncident.findMany({
        where: { brandId: activeBrandId, supplierId: id },
        select: { severity: true },
      });

      const totalDelivered = supplier.totalOrdersDelivered || 0;
      const otifRate = supplier.otifRatePct || 100;
      const avgVariance = supplier.avgPriceVariancePct || 0;
      const criticalCount = allIncidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;

      const rating = calculateSupplierRating({
        totalOrders: totalDelivered,
        otifRatePct: otifRate,
        avgPriceVariancePct: avgVariance,
        incidentCount: allIncidents.length,
        criticalIncidents: criticalCount,
      });

      await tx.supplier.update({
        where: { id },
        data: {
          overallScore: rating.score,
          ratingTier: rating.tier,
        },
      });

      return created;
    });

    await recordAuditLog({
      action: 'SUPPLIER_INCIDENT_LOGGED',
      entityType: 'SUPPLIER',
      entityId: id,
      details: {
        supplierName: supplier.name,
        incidentType,
        severity,
        financialImpact,
        purchaseOrderId,
      },
      severity: severity === 'CRITICAL' ? 'WARNING' : 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, incident });
  } catch (error: unknown) {
    console.error('Error logging supplier incident:', error);
    return NextResponse.json({ error: 'Error al registrar la incidencia del proveedor' }, { status: 500 });
  }
}
