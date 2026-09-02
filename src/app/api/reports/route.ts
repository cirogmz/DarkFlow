import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado para consultar reportes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'sales';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const brandIdParam = searchParams.get('brandId');

    // Date range parsing (default: last 30 days if not provided)
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam ? new Date(endDateParam) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Resolve brand filter based on session permissions
    let allowedBrandIds: string[] = [];
    if (session.role === 'SUPER_ADMIN') {
      if (brandIdParam && brandIdParam !== 'ALL') {
        allowedBrandIds = [brandIdParam];
      }
    } else {
      if (brandIdParam && brandIdParam !== 'ALL') {
        if (session.brandIds.includes(brandIdParam)) {
          allowedBrandIds = [brandIdParam];
        } else {
          return NextResponse.json({ error: 'Acceso no permitido a esta marca' }, { status: 403 });
        }
      } else {
        allowedBrandIds = session.brandIds;
      }
    }

    // 1. SALES REPORT
    if (type === 'sales') {
      const whereClause: {
        createdAt: { gte: Date; lte: Date };
        brandId?: { in: string[] };
      } = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (allowedBrandIds.length > 0) {
        whereClause.brandId = { in: allowedBrandIds };
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              primaryColor: true,
            },
          },
          table: {
            select: {
              id: true,
              number: true,
              name: true,
              zone: true,
            },
          },
          driver: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
              vehicleType: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate summaries
      let totalRevenue = 0;
      let totalTax = 0;
      let totalTip = 0;
      let totalDiners = 0;
      const salesBySource: Record<string, { count: number; total: number }> = {};
      const salesByBrand: Record<string, { name: string; count: number; total: number }> = {};

      orders.forEach((o) => {
        totalRevenue += o.total;
        totalTax += o.tax;
        totalTip += o.tip;
        totalDiners += o.diners || 0;

        // By Source
        if (!salesBySource[o.source]) {
          salesBySource[o.source] = { count: 0, total: 0 };
        }
        salesBySource[o.source].count += 1;
        salesBySource[o.source].total += o.total;

        // By Brand
        if (!salesByBrand[o.brandId]) {
          salesByBrand[o.brandId] = { name: o.brand.name, count: 0, total: 0 };
        }
        salesByBrand[o.brandId].count += 1;
        salesByBrand[o.brandId].total += o.total;
      });

      const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

      return NextResponse.json({
        type: 'sales',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalOrders: orders.length,
          totalRevenue,
          totalTax,
          totalTip,
          totalDiners,
          avgTicket,
          salesBySource,
          salesByBrand,
        },
        data: orders,
      });
    }

    // 2. CASH SESSIONS REPORT
    if (type === 'cash') {
      const whereClause: {
        openedAt: { gte: Date; lte: Date };
        brandId?: { in: string[] };
      } = {
        openedAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (allowedBrandIds.length > 0) {
        whereClause.brandId = { in: allowedBrandIds };
      }

      const sessions = await prisma.cashSession.findMany({
        where: whereClause,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              primaryColor: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          openedAt: 'desc',
        },
      });

      let totalCashSales = 0;
      let totalCardSales = 0;
      let totalAppsSales = 0;
      let totalDiscrepancies = 0;

      sessions.forEach((s) => {
        totalCashSales += s.cashSales;
        totalCardSales += s.cardSales;
        totalAppsSales += s.appsSales;
        if (s.actualBalance !== null && s.expectedBalance !== null) {
          totalDiscrepancies += s.actualBalance - s.expectedBalance;
        }
      });

      return NextResponse.json({
        type: 'cash',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalSessions: sessions.length,
          totalCashSales,
          totalCardSales,
          totalAppsSales,
          totalDiscrepancies,
        },
        data: sessions,
      });
    }

    // 3. INVENTORY VALUATION REPORT
    if (type === 'inventory') {
      const whereClause: {
        brandId?: { in: string[] };
      } = {};

      if (allowedBrandIds.length > 0) {
        whereClause.brandId = { in: allowedBrandIds };
      }

      const ingredients = await prisma.ingredient.findMany({
        where: whereClause,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              primaryColor: true,
            },
          },
        },
        orderBy: [
          { brand: { name: 'asc' } },
          { name: 'asc' },
        ],
      });

      let totalInventoryValuation = 0;
      let lowStockCount = 0;

      ingredients.forEach((ing) => {
        totalInventoryValuation += ing.stock * ing.cost;
        if (ing.stock <= ing.minStock) {
          lowStockCount += 1;
        }
      });

      return NextResponse.json({
        type: 'inventory',
        summary: {
          totalItems: ingredients.length,
          totalInventoryValuation,
          lowStockCount,
        },
        data: ingredients,
      });
    }

    return NextResponse.json({ error: 'Tipo de reporte inválido' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Error interno al generar reporte' }, { status: 500 });
  }
}
