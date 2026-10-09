import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const selectedBrandId = searchParams.get('brandId') || 'ALL';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);

    // 1. Fetch Brands
    const brands = await prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        isActive: true,
      },
    });

    const brandFilter = selectedBrandId !== 'ALL' ? { brandId: selectedBrandId } : {};

    // 2. Fetch Orders for Today & Yesterday
    const [todayOrders, yesterdayOrders, activeOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...brandFilter,
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          orderNumber: true,
          brandId: true,
          total: true,
          status: true,
          source: true,
          paymentStatus: true,
          paymentMethod: true,
          diners: true,
          createdAt: true,
        },
      }),
      prisma.order.findMany({
        where: {
          ...brandFilter,
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
          status: { not: 'CANCELLED' },
        },
        select: {
          total: true,
        },
      }),
      prisma.order.findMany({
        where: {
          ...brandFilter,
          status: { in: ['RECEIVED', 'COOKING', 'READY', 'IN_TRANSIT'] },
        },
        include: {
          brand: { select: { name: true, primaryColor: true } },
          table: { select: { name: true, number: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // 3. Today's Calculations
    const totalSalesToday = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const ordersCountToday = todayOrders.length;
    const ticketAverageToday = ordersCountToday > 0 ? Number((totalSalesToday / ordersCountToday).toFixed(2)) : 0;

    const totalSalesYesterday = yesterdayOrders.reduce((sum, o) => sum + o.total, 0);
    const growthVsYesterdayPct = totalSalesYesterday > 0
      ? Number((((totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100).toFixed(1))
      : 0;

    // 4. Payment Methods & Channels
    let cashSales = 0;
    let cardSales = 0;
    let appsSales = 0;
    let giftCardSales = 0;
    let otherSales = 0;

    todayOrders.forEach((o) => {
      const pm = (o.paymentMethod || '').toUpperCase();
      const src = (o.source || '').toUpperCase();

      if (src === 'UBER_EATS' || src === 'RAPPI' || src === 'DIDI_FOOD') {
        appsSales += o.total;
      } else if (pm === 'CASH' || pm === 'EFECTIVO') {
        cashSales += o.total;
      } else if (pm === 'CARD' || pm === 'TARJETA' || pm === 'STRIPE' || pm === 'MERCADOPAGO') {
        cardSales += o.total;
      } else if (pm === 'GIFT_CARD' || pm === 'MONEDERO') {
        giftCardSales += o.total;
      } else {
        otherSales += o.total;
      }
    });

    // 5. Multi-Brand Telemetry
    const brandsTelemetry = brands.map((b) => {
      const bOrders = todayOrders.filter((o) => o.brandId === b.id);
      const bSales = bOrders.reduce((sum, o) => sum + o.total, 0);
      const bCount = bOrders.length;
      const bTicket = bCount > 0 ? Number((bSales / bCount).toFixed(2)) : 0;
      const bActiveCount = activeOrders.filter((o) => o.brandId === b.id).length;

      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        isActive: b.isActive,
        salesToday: Number(bSales.toFixed(2)),
        ordersCount: bCount,
        ticketAverage: bTicket,
        activeOrdersCount: bActiveCount,
      };
    }).sort((a, b) => b.salesToday - a.salesToday);

    // 6. Cash Sessions & Cuts (Vault Pulse)
    const [openCashSessions, todayCashCuts] = await Promise.all([
      prisma.cashSession.findMany({
        where: {
          ...brandFilter,
          status: 'OPEN',
        },
        include: {
          brand: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.cashCut.findMany({
        where: {
          cutAt: { gte: todayStart, lte: todayEnd },
          ...(selectedBrandId !== 'ALL' ? { cashSession: { brandId: selectedBrandId } } : {}),
        },
        include: {
          cashSession: {
            include: {
              brand: { select: { name: true } },
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { cutAt: 'desc' },
      }),
    ]);

    const cashDiscrepancies = todayCashCuts.filter((cut) => Math.abs(cut.cashDifference) > 1);

    // 7. Critical Owner Alerts
    // A: Detractor surveys pending
    const pendingDetractors = await prisma.satisfactionSurvey.findMany({
      where: {
        ...brandFilter,
        status: 'PENDING_RESOLUTION',
      },
      include: {
        order: { select: { orderNumber: true, total: true } },
        brand: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // B: Low Stock Ingredients
    const lowStockIngredients = await prisma.ingredient.findMany({
      where: {
        ...brandFilter,
        stock: { lte: prisma.ingredient.fields.minStock },
      },
      include: {
        brand: { select: { name: true } },
      },
      take: 8,
    });

    // C: Delayed Active Orders (> 25 min in prep)
    const twentyFiveMinutesAgo = new Date(Date.now() - 25 * 60 * 1000);
    const delayedOrders = activeOrders.filter((o) => o.createdAt <= twentyFiveMinutesAgo);

    // 8. Structured WhatsApp Digest
    const dateFormatted = now.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const topBrandText = brandsTelemetry.length > 0
      ? brandsTelemetry.slice(0, 3).map((b) => `• *${b.name}:* $${b.salesToday.toLocaleString('es-MX')} (${b.ordersCount} pedidos)`).join('\n')
      : '• Sin ventas aún';

    const whatsappDigest = `📊 *DARKFLOW MANAGER - REPORTE EJECUTIVO*\n📅 ${dateFormatted.toUpperCase()}\n\n` +
      `💰 *Venta Hoy:* $${totalSalesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n` +
      `📈 *Tendencia vs Ayer:* ${growthVsYesterdayPct >= 0 ? `+${growthVsYesterdayPct}% 🟢` : `${growthVsYesterdayPct}% 🔻`}\n` +
      `🎫 *Comandas:* ${ordersCountToday} | *Ticket Prom:* $${ticketAverageToday.toFixed(2)} MXN\n` +
      `⚡ *En Proceso Ahora:* ${activeOrders.length} comandas en cocina\n\n` +
      `🏆 *Top Marcas:* \n${topBrandText}\n\n` +
      `💳 *Ingresos por Canal:* \n` +
      `• Efectivo: $${cashSales.toFixed(2)}\n` +
      `• Tarjeta/Online: $${cardSales.toFixed(2)}\n` +
      `• Apps Delivery: $${appsSales.toFixed(2)}\n\n` +
      `🚨 *Alertas Operativas:*\n` +
      `• Cajas con Descuadre: ${cashDiscrepancies.length}\n` +
      `• Quejas NPS por Resolver: ${pendingDetractors.length}\n` +
      `• Insumos Críticos Bajo Mínimo: ${lowStockIngredients.length}\n` +
      `• Pedidos Retrasados (>25m): ${delayedOrders.length}\n\n` +
      `_Generado desde DarkFlow Mobile Owner Hub_`;

    return NextResponse.json({
      timestamp: now.toISOString(),
      livePulse: {
        totalSalesToday: Number(totalSalesToday.toFixed(2)),
        ordersCountToday,
        ticketAverageToday,
        totalSalesYesterday: Number(totalSalesYesterday.toFixed(2)),
        growthVsYesterdayPct,
        activeOrdersCount: activeOrders.length,
      },
      paymentBreakdown: {
        cashSales: Number(cashSales.toFixed(2)),
        cardSales: Number(cardSales.toFixed(2)),
        appsSales: Number(appsSales.toFixed(2)),
        giftCardSales: Number(giftCardSales.toFixed(2)),
        otherSales: Number(otherSales.toFixed(2)),
      },
      brandsTelemetry,
      activeOrders: activeOrders.slice(0, 10).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        brandName: o.brand.name,
        total: o.total,
        status: o.status,
        source: o.source,
        tableName: o.table?.name || null,
        minutesElapsed: Math.round((Date.now() - o.createdAt.getTime()) / (60 * 1000)),
      })),
      vaultPulse: {
        openSessionsCount: openCashSessions.length,
        openSessions: openCashSessions.map((s) => ({
          id: s.id,
          brandName: s.brand.name,
          cashierName: s.user.name,
          openingBalance: s.openingBalance,
          openedAt: s.openedAt,
        })),
        recentCuts: todayCashCuts.slice(0, 5).map((c) => ({
          id: c.id,
          cutType: c.cutType,
          cutNumber: c.cutNumber,
          cashierName: c.cashSession.user.name,
          brandName: c.cashSession.brand.name,
          totalSales: c.totalSales,
          cashDifference: c.cashDifference,
          cutAt: c.cutAt,
        })),
        discrepanciesCount: cashDiscrepancies.length,
      },
      alerts: {
        pendingDetractors: pendingDetractors.map((d) => ({
          id: d.id,
          orderNumber: d.order.orderNumber,
          brandName: d.brand.name,
          overallRating: d.overallRating,
          npsScore: d.npsScore,
          customerName: d.customerName || 'Anónimo',
          customerPhone: d.customerPhone || null,
          comment: d.comment || null,
          createdAt: d.createdAt,
        })),
        lowStockIngredients: lowStockIngredients.map((i) => ({
          id: i.id,
          name: i.name,
          brandName: i.brand.name,
          stock: i.stock,
          minStock: i.minStock,
          unit: i.unit,
        })),
        delayedOrders: delayedOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          brandName: o.brand.name,
          total: o.total,
          minutesElapsed: Math.round((Date.now() - o.createdAt.getTime()) / (60 * 1000)),
        })),
        cashDiscrepanciesCount: cashDiscrepancies.length,
      },
      whatsappDigest,
    });
  } catch (error) {
    console.error('Error fetching Mobile Owner Hub telemetry:', error);
    return NextResponse.json({ error: 'Error al consultar telemetría ejecutiva' }, { status: 500 });
  }
}
