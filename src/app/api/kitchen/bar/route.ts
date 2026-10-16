import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function isBarItem(item: any): boolean {
  if (item.product?.kitchenStation === 'BARRA') return true;
  if (item.serviceStage === 'DRINK') return true;
  const cat = (item.product?.category?.name || '').toLowerCase();
  const prodName = (item.product?.name || '').toLowerCase();
  const drinkKeywords = ['bebid', 'drink', 'bar', 'coctel', 'cocktail', 'cerveza', 'vino', 'licor', 'cafe', 'cafeteria', 'jugo', 'refresco', 'trago', 'mezcal', 'tequila', 'soda', 'limonada', 'naranjada', 'infusion', 'smoothie', 'malteada'];
  return drinkKeywords.some((kw) => cat.includes(kw) || prodName.includes(kw));
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandId = session.activeBrandId;

    // Fetch active orders (RECEIVED, PREPARING, READY)
    const rawOrders = await prisma.order.findMany({
      where: {
        brandId,
        status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
      },
      include: {
        table: true,
        waiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                recipeItems: {
                  include: {
                    ingredient: {
                      select: { id: true, name: true, unit: true, stock: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filter to only orders containing bar/drink items
    const barOrders: any[] = [];
    const consolidatedMap = new Map<string, any>();

    let totalPendingDrinks = 0;
    let totalReadyDrinks = 0;
    let ordersReadyCount = 0;

    for (const order of rawOrders) {
      const barItems = order.items.filter(isBarItem);
      if (barItems.length === 0) continue;

      const totalItemsCount = barItems.reduce((acc, i) => acc + i.quantity, 0);
      const doneItemsCount = barItems.filter((i) => i.status === 'DONE').reduce((acc, i) => acc + i.quantity, 0);
      const isBarComplete = doneItemsCount >= totalItemsCount && totalItemsCount > 0;

      if (isBarComplete) {
        ordersReadyCount++;
      }

      totalPendingDrinks += (totalItemsCount - doneItemsCount);
      totalReadyDrinks += doneItemsCount;

      const formattedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        source: order.source,
        status: order.status,
        customerName: order.customerName,
        notes: order.notes,
        tableId: order.tableId,
        tableNumber: order.table?.number || null,
        tableName: order.table?.name || null,
        diners: order.diners,
        waiterId: order.waiterId,
        waiterName: order.waiter?.name || null,
        barStatus: order.barStatus || (isBarComplete ? 'READY' : (doneItemsCount > 0 ? 'PREPARING' : 'PENDING')),
        barNotifiedAt: order.barNotifiedAt,
        barCompletedAt: order.barCompletedAt,
        targetPrepTimeMinutes: order.prepTimeTarget ? Math.min(order.prepTimeTarget, 5) : 4, // Fast drink SLA (3-5 min)
        createdAt: order.createdAt,
        totalItemsCount,
        doneItemsCount,
        isBarComplete,
        items: barItems.map((i) => {
          let parsedModifiers = null;
          try {
            if (i.modifiers) {
              parsedModifiers = typeof i.modifiers === 'string' ? JSON.parse(i.modifiers) : i.modifiers;
            }
          } catch {
            parsedModifiers = i.modifiers;
          }

          // Build cocktail recipe specs (e.g. 2 oz Ron, 1 oz Limón)
          const recipeSpecs = i.product?.recipeItems?.map((r) => ({
            ingredientId: r.ingredientId,
            ingredientName: r.ingredient.name,
            quantity: r.quantity,
            unit: r.ingredient.unit,
            inStock: r.ingredient.stock,
          })) || [];

          return {
            id: i.id,
            productId: i.productId,
            name: i.product.name,
            categoryName: i.product.category?.name || 'Bebidas',
            quantity: i.quantity,
            price: i.price,
            notes: i.notes,
            modifiers: parsedModifiers,
            status: i.status,
            barChecked: i.barChecked,
            startedAt: i.startedAt,
            finishedAt: i.finishedAt,
            servedAt: i.servedAt,
            serviceStage: i.serviceStage,
            allergenAlert: i.allergenAlert,
            recipeSpecs,
          };
        }),
      };

      barOrders.push(formattedOrder);

      // Add to consolidated batch queue (only if not completely done)
      for (const item of barItems) {
        if (item.status === 'DONE') continue;

        const key = item.productId;
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            productId: item.productId,
            productName: item.product.name,
            categoryName: item.product.category?.name || 'Bebidas',
            totalQuantity: 0,
            recipeSpecs: item.product?.recipeItems?.map((r) => ({
              ingredientName: r.ingredient.name,
              quantity: r.quantity,
              unit: r.ingredient.unit,
            })) || [],
            orderQueues: [],
          });
        }

        const entry = consolidatedMap.get(key);
        entry.totalQuantity += item.quantity;
        entry.orderQueues.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          tableNumber: order.table?.number || 'Barra/Mostrador',
          quantity: item.quantity,
          notes: item.notes,
          modifiers: item.modifiers,
          createdAt: order.createdAt,
        });
      }
    }

    const consolidatedQueue = Array.from(consolidatedMap.values()).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    return NextResponse.json({
      success: true,
      orders: barOrders,
      consolidatedQueue,
      stats: {
        activeOrdersCount: barOrders.length,
        totalPendingDrinks,
        totalReadyDrinks,
        ordersReadyCount,
        targetSlaMinutes: 4,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching bar station orders:', error);
    return NextResponse.json({ error: 'Error al consultar comanda de barra' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandId = session.activeBrandId;
    const body = await req.json();
    const { action, orderId, itemId, status } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, brandId },
      include: {
        table: true,
        waiter: true,
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 });
    }

    const now = new Date();

    // 1. ACTION: START_DRINKS (En preparación en barra)
    if (action === 'START_DRINKS') {
      const barItemIds = order.items.filter(isBarItem).map((i) => i.id);

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { barStatus: 'PREPARING' },
        }),
        prisma.orderItem.updateMany({
          where: { id: { in: barItemIds }, status: 'PENDING' },
          data: { status: 'COOKING', startedAt: now },
        }),
      ]);

      orderEvents.emit('order_event', {
        action: 'UPDATED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        brandId,
        source: order.source,
        tableNumber: order.table?.number,
        timestamp: now.toISOString(),
      });

      return NextResponse.json({ success: true, message: 'Bebidas puestas en preparación' });
    }

    // 2. ACTION: READY_DRINKS (Todas las bebidas de la orden listas para retiro en barra)
    if (action === 'READY_DRINKS') {
      const barItemIds = order.items.filter(isBarItem).map((i) => i.id);

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            barStatus: 'READY',
            barCompletedAt: now,
            barNotifiedAt: now,
          },
        }),
        prisma.orderItem.updateMany({
          where: { id: { in: barItemIds } },
          data: { status: 'DONE', finishedAt: now, barChecked: true },
        }),
      ]);

      // Emit specific DRINKS_READY event so waiters and Expo get immediate alert
      orderEvents.emit('order_event', {
        action: 'DRINKS_READY',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        brandId,
        source: order.source,
        tableId: order.tableId,
        tableNumber: order.table?.number,
        waiterId: order.waiterId,
        waiterName: order.waiter?.name,
        station: 'BARRA',
        timestamp: now.toISOString(),
      });

      await recordAuditLog({
        action: 'BAR_DRINKS_READY',
        entityType: 'ORDER',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          tableNumber: order.table?.number,
          drinksCount: barItemIds.length,
        },
        severity: 'INFO',
        brandId,
        userId: session.userId,
        req,
      });

      return NextResponse.json({
        success: true,
        message: `Bebidas de Comanda #${order.orderNumber} listas en barra`,
      });
    }

    // 3. ACTION: TOGGLE_BAR_ITEM
    if (action === 'TOGGLE_BAR_ITEM') {
      if (!itemId) {
        return NextResponse.json({ error: 'itemId requerido' }, { status: 400 });
      }

      const item = order.items.find((i) => i.id === itemId);
      if (!item) {
        return NextResponse.json({ error: 'Ítem no encontrado en comanda' }, { status: 404 });
      }

      const nextStatus = status || (item.status === 'DONE' ? 'PENDING' : 'DONE');
      const isDone = nextStatus === 'DONE';

      await prisma.orderItem.update({
        where: { id: itemId },
        data: {
          status: nextStatus,
          barChecked: isDone,
          finishedAt: isDone ? now : null,
        },
      });

      // Check if all bar items are now done
      const updatedBarItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
        include: { product: { include: { category: true } } },
      });
      const barItems = updatedBarItems.filter(isBarItem);
      const allDone = barItems.length > 0 && barItems.every((i) => i.status === 'DONE');

      if (allDone) {
        await prisma.order.update({
          where: { id: order.id },
          data: { barStatus: 'READY', barCompletedAt: now },
        });

        orderEvents.emit('order_event', {
          action: 'DRINKS_READY',
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          brandId,
          source: order.source,
          tableId: order.tableId,
          tableNumber: order.table?.number,
          waiterId: order.waiterId,
          waiterName: order.waiter?.name,
          station: 'BARRA',
          timestamp: now.toISOString(),
        });
      }

      return NextResponse.json({ success: true, allDone, nextStatus });
    }

    // 4. ACTION: CALL_WAITER_BAR (Llamar al mesero para recoger bebidas en barra)
    if (action === 'CALL_WAITER_BAR') {
      await prisma.order.update({
        where: { id: order.id },
        data: { barNotifiedAt: now },
      });

      orderEvents.emit('order_event', {
        action: 'WAITER_CALLED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        brandId,
        source: order.source,
        tableId: order.tableId,
        tableNumber: order.table?.number,
        waiterId: order.waiterId,
        waiterName: order.waiter?.name,
        station: 'BARRA',
        timestamp: now.toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Aviso enviado al mesero (${order.waiter?.name || 'Salón'}) para retiro en Barra`,
      });
    }

    // 5. ACTION: SERVE_DRINKS (Bebidas entregadas a la mesa / comensal)
    if (action === 'SERVE_DRINKS') {
      const barItemIds = order.items.filter(isBarItem).map((i) => i.id);

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { barStatus: 'SERVED' },
        }),
        prisma.orderItem.updateMany({
          where: { id: { in: barItemIds } },
          data: { servedAt: now },
        }),
      ]);

      orderEvents.emit('order_event', {
        action: 'UPDATED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        brandId,
        source: order.source,
        timestamp: now.toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: 'Bebidas marcadas como servidas en mesa',
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in bar station action:', error);
    return NextResponse.json({ error: 'Error al procesar acción de barra' }, { status: 500 });
  }
}
