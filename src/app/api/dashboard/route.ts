import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Super Admin comparison panel (if applicable)
    let brandComparison = null;
    if (session.role === 'SUPER_ADMIN') {
      const brands = await prisma.brand.findMany();
      
      brandComparison = await Promise.all(
        brands.map(async (brand) => {
          const brandOrders = await prisma.order.findMany({
            where: {
              brandId: brand.id,
              status: 'DELIVERED',
            },
          });

          const totalSales = brandOrders.reduce((sum, order) => sum + order.total, 0);
          const totalCount = brandOrders.length;
          const ticketPromedio = totalCount > 0 ? parseFloat((totalSales / totalCount).toFixed(2)) : 0;

          return {
            brandName: brand.name,
            primaryColor: brand.primaryColor,
            totalSales: parseFloat(totalSales.toFixed(2)),
            ordersCount: totalCount,
            ticketAverage: ticketPromedio,
          };
        })
      );
    }

    // If no active brand is selected, we only return the brand comparison
    if (!session.activeBrandId) {
      return NextResponse.json({ brandComparison });
    }

    // 2. Load active brand details
    const activeBrandId = session.activeBrandId;

    // Load completed orders for the active brand
    const activeOrders = await prisma.order.findMany({
      where: {
        brandId: activeBrandId,
        status: 'DELIVERED',
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Today's orders
    const todayOrders = activeOrders.filter(o => o.createdAt >= todayStart && o.createdAt <= todayEnd);

    // Calculations
    const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const todayCount = todayOrders.length;
    const allTimeSales = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const allTimeCount = activeOrders.length;
    const ticketPromedio = allTimeCount > 0 ? parseFloat((allTimeSales / allTimeCount).toFixed(2)) : 0;

    // Simulated average delivery time (MVP: calculate difference in minutes between createdAt and updatedAt)
    const deliveredWithTime = activeOrders.filter(o => o.status === 'DELIVERED' && o.updatedAt);
    let totalDeliveryTimeMins = 0;
    deliveredWithTime.forEach((o) => {
      const diffMs = o.updatedAt.getTime() - o.createdAt.getTime();
      totalDeliveryTimeMins += Math.max(12, Math.floor(diffMs / (60 * 1000))); // Cap minimum at 12 mins
    });
    const avgDeliveryTime = deliveredWithTime.length > 0 
      ? Math.round(totalDeliveryTimeMins / deliveredWithTime.length) 
      : 25; // default 25 mins

    // 3. Recharts chart aggregations
    
    // Hourly sales for today
    const hourlySales: Record<number, number> = {};
    for (let h = 8; h <= 22; h += 2) {
      hourlySales[h] = 0; // initialize slots from 8 AM to 10 PM
    }
    todayOrders.forEach((order) => {
      const hour = order.createdAt.getHours();
      const bucket = Math.floor(hour / 2) * 2; // group in 2h intervals
      if (bucket >= 8 && bucket <= 22) {
        hourlySales[bucket] += order.total;
      }
    });
    const hourlyData = Object.entries(hourlySales).map(([hour, total]) => ({
      hour: `${hour}:00`,
      ventas: parseFloat(total.toFixed(2)),
    }));

    // Sales by Platform
    const platformSales = { UBER_EATS: 0, RAPPI: 0, WEB: 0, PHONE: 0 };
    activeOrders.forEach((o) => {
      const src = o.source as keyof typeof platformSales;
      if (platformSales[src] !== undefined) {
        platformSales[src] += o.total;
      }
    });
    const platformData = Object.entries(platformSales).map(([name, value]) => ({
      name: name.replace('_', ' '),
      value: parseFloat(value.toFixed(2)),
    }));

    // Platos más vendidos (Top products)
    const productCounts: Record<string, { name: string; quantity: number; sales: number }> = {};
    activeOrders.forEach((order) => {
      order.items.forEach((item) => {
        const prod = item.product;
        if (!productCounts[prod.id]) {
          productCounts[prod.id] = { name: prod.name, quantity: 0, sales: 0 };
        }
        productCounts[prod.id].quantity += item.quantity;
        productCounts[prod.id].sales += item.quantity * item.price;
      });
    });
    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Evolution weekly (7 days)
    const weeklyData: Array<{ day: string; ventas: number; ordenes: number }> = [];
    const daysName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      const end = start + 24 * 60 * 60 * 1000;

      const dayOrders = activeOrders.filter(
        (o) => o.createdAt.getTime() >= start && o.createdAt.getTime() < end
      );

      const daySales = dayOrders.reduce((sum, o) => sum + o.total, 0);

      weeklyData.push({
        day: daysName[d.getDay()],
        ventas: parseFloat(daySales.toFixed(2)),
        ordenes: dayOrders.length,
      });
    }

    return NextResponse.json({
      kpis: {
        todaySales: parseFloat(todaySales.toFixed(2)),
        todayOrders: todayCount,
        ticketAverage: ticketPromedio,
        avgDeliveryTime,
      },
      charts: {
        hourlyData,
        platformData,
        topProducts,
        weeklyData,
      },
      brandComparison,
    });
  } catch (error: any) {
    console.error('Error generating dashboard stats:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
