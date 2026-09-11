import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado para consultar registros de auditoría' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const severity = searchParams.get('severity');
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const search = searchParams.get('search')?.trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const requestedBrandId = searchParams.get('brandId');

    // Determine brand scope based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (session.role === 'SUPER_ADMIN') {
      if (requestedBrandId && requestedBrandId !== 'ALL') {
        where.brandId = requestedBrandId;
      }
    } else {
      // BRAND_ADMIN: restricted to user's assigned brands
      if (requestedBrandId && requestedBrandId !== 'ALL' && session.brandIds.includes(requestedBrandId)) {
        where.brandId = requestedBrandId;
      } else if (session.brandIds.length > 0) {
        where.brandId = { in: session.brandIds };
      } else if (session.activeBrandId) {
        where.brandId = session.activeBrandId;
      }
    }

    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }

    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType;
    }

    if (action && action !== 'ALL') {
      where.action = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entityType: { contains: search } },
        { entityId: { contains: search } },
        { ipAddress: { contains: search } },
        { details: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    // Base where condition for summary counters (scoped to brand without specific filter params)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseBrandWhere: any = {};
    if (where.brandId) {
      baseBrandWhere.brandId = where.brandId;
    }

    const [logs, total, totalEvents, criticalCount, warningCount, infoCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: baseBrandWhere }),
      prisma.auditLog.count({ where: { ...baseBrandWhere, severity: 'CRITICAL' } }),
      prisma.auditLog.count({ where: { ...baseBrandWhere, severity: 'WARNING' } }),
      prisma.auditLog.count({ where: { ...baseBrandWhere, severity: 'INFO' } }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalEvents,
        criticalCount,
        warningCount,
        infoCount,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Error interno al consultar logs de auditoría' }, { status: 500 });
  }
}
