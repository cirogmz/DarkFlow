import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { calculateLossPreventionMetrics, createSecurityIncident, SecurityIncidentType, IncidentSeverity } from '@/lib/lossPrevention';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || (session.activeBrandId as string | undefined);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 250);

    const where: Prisma.SecurityIncidentWhereInput = {};

    if (brandId && session.role !== 'SUPER_ADMIN') {
      where.brandId = brandId;
    } else if (brandId && brandId !== 'ALL') {
      where.brandId = brandId;
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [incidents, allScopedIncidents] = await Promise.all([
      prisma.securityIncident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          brand: { select: { id: true, name: true, primaryColor: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
              customerName: true,
              prebillPrintedAt: true,
              prebillPrintedCount: true,
            },
          },
          user: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.securityIncident.findMany({
        where: brandId && brandId !== 'ALL' && session.role !== 'SUPER_ADMIN' ? { brandId } : {},
        select: {
          severity: true,
          type: true,
          amountAtRisk: true,
          status: true,
        },
      }),
    ]);

    const metrics = calculateLossPreventionMetrics(allScopedIncidents);

    return NextResponse.json({
      incidents,
      metrics,
    });
  } catch (error) {
    console.error('Error fetching security incidents:', error);
    return NextResponse.json({ error: 'Error al consultar auditoría antifraude' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      brandId = session.activeBrandId,
      orderId,
      type,
      severity = 'HIGH',
      description,
      amountAtRisk = 0,
      metadata,
    } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId es requerido' }, { status: 400 });
    }

    if (!type || !description) {
      return NextResponse.json({ error: 'type y description son requeridos' }, { status: 400 });
    }

    const incident = await createSecurityIncident({
      brandId,
      orderId,
      type: type as SecurityIncidentType,
      severity: severity as IncidentSeverity,
      description,
      amountAtRisk: Number(amountAtRisk) || 0,
      userId: session.userId,
      userName: session.email,
      metadata,
    });

    if (!incident) {
      return NextResponse.json({ error: 'Error al registrar incidente' }, { status: 500 });
    }

    return NextResponse.json({ success: true, incident });
  } catch (error) {
    console.error('Error creating security incident:', error);
    return NextResponse.json({ error: 'Error interno al registrar alerta de seguridad' }, { status: 500 });
  }
}
