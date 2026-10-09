import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { generateKotBuffer, sendToNetworkPrinter } from '@/lib/escpos';
import { recordAuditLog } from '@/lib/audit';

interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
  notes?: string | null;
  modifiers?: unknown;
  serviceStage?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const brandId = session.activeBrandId;
    const body = await req.json();
    const {
      tableId,
      diners = 1,
      waiterId,
      customerName,
      items = [],
      notes,
    } = body;

    if (!tableId) {
      return NextResponse.json({ error: 'Falta tableId' }, { status: 400 });
    }

    const typedItems: OrderItemInput[] = Array.isArray(items) ? items : [];

    // Verify table exists
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
          },
          include: {
            items: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!table || table.brandId !== brandId) {
      return NextResponse.json({ error: 'Mesa no encontrada en esta sucursal' }, { status: 404 });
    }

    // Determine target waiter ID
    const effectiveWaiterId = waiterId || session.userId;

    // Load products for pricing, recipe items, and KDS categories
    const productIds = typedItems.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: true,
      },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    // Check if table already has an active order
    const existingOrder = table.orders[0] || null;

    if (existingOrder) {
      // -------------------------------------------------------------
      // CASE 1: Table is already OPEN -> Add additional items (Adición / Marcha)
      // -------------------------------------------------------------
      if (typedItems.length === 0) {
        return NextResponse.json(
          { error: 'Para agregar a una comanda existente se requieren productos' },
          { status: 400 }
        );
      }

      // Calculate totals for new items
      let additionalSubtotal = 0;
      const newItemsData = typedItems.map((item) => {
        const p = prodMap.get(item.productId);
        const itemPrice = typeof item.price === 'number' ? item.price : (p?.price || 0);
        additionalSubtotal += itemPrice * item.quantity;

        let detectedStage = item.serviceStage;
        if (!detectedStage && p?.category?.name) {
          const catName = p.category.name.toLowerCase();
          if (catName.includes('bebid') || catName.includes('drink') || catName.includes('trago') || catName.includes('refresco')) {
            detectedStage = 'DRINK';
          } else if (catName.includes('entrad') || catName.includes('aperitiv') || catName.includes('starter') || catName.includes('botana')) {
            detectedStage = 'STARTER';
          } else if (catName.includes('postre') || catName.includes('dessert') || catName.includes('dulce') || catName.includes('helado')) {
            detectedStage = 'DESSERT';
          } else {
            detectedStage = 'MAIN';
          }
        }

        return {
          orderId: existingOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: itemPrice,
          notes: item.notes || null,
          modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers)) : null,
          status: 'PENDING',
          serviceStage: detectedStage || 'MAIN',
        };
      });

      const additionalTax = Number((additionalSubtotal * 0.16).toFixed(2));
      const additionalTotal = Number((additionalSubtotal + additionalTax).toFixed(2));

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Create new items
        await tx.orderItem.createMany({
          data: newItemsData,
        });

        // Update order totals and status
        const upd = await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            subtotal: { increment: additionalSubtotal },
            tax: { increment: additionalTax },
            total: { increment: additionalTotal },
            status: existingOrder.status === 'READY' ? 'PREPARING' : existingOrder.status,
            waiterId: effectiveWaiterId || existingOrder.waiterId,
          },
          include: {
            items: {
              include: { product: true },
            },
            table: true,
            waiter: true,
          },
        });

        // Ensure table status is OCCUPIED (e.g. if was in PREBILL)
        await tx.table.update({
          where: { id: table.id },
          data: {
            status: 'OCCUPIED',
            assignedWaiterId: effectiveWaiterId || table.assignedWaiterId,
          },
        });

        return upd;
      });

      // Broadcast SSE event to kitchen KDS
      orderEvents.emit('order_updated', {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        brandId,
        tableNumber: table.number,
        action: 'ITEMS_ADDED',
      });

      // Kitchen printer dispatch for additions
      try {
        const autoPrinters = await prisma.printer.findMany({
          where: { brandId, isActive: true },
        });

        if (autoPrinters.length > 0) {
          const brand = await prisma.brand.findUnique({ where: { id: brandId } });
          const processedOrder = {
            ...updatedOrder,
            brand: brand || undefined,
            items: newItemsData.map((it: any) => {
              let parsedMods = [];
              if (it.modifiers) {
                try {
                  parsedMods = typeof it.modifiers === 'string' ? JSON.parse(it.modifiers) : it.modifiers;
                } catch {
                  parsedMods = [];
                }
              }
              return {
                ...it,
                product: prodMap.get(it.productId),
                selectedModifiers: parsedMods,
              };
            }),
          };

          for (const p of autoPrinters) {
            if (p.connectionType === 'VIRTUAL') continue;
            const kot = generateKotBuffer(processedOrder, p);
            if (kot && kot.itemCount > 0) {
              sendToNetworkPrinter(p.ipAddress, p.port, kot.buffer).catch((err) =>
                console.error(`[AutoPrint] Error printing additions to ${p.name}:`, err)
              );
            }
          }
        }
      } catch (printErr) {
        console.error('Error auto-printing additions to kitchen:', printErr);
      }

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'WAITER_ITEMS_ADDED',
        entityType: 'Order',
        entityId: updatedOrder.id,
        details: {
          tableNumber: table.number,
          orderNumber: updatedOrder.orderNumber,
          newItemsCount: newItemsData.length,
          additionalTotal,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'ITEMS_ADDED',
        order: updatedOrder,
        message: `Comanda #${updatedOrder.orderNumber} (Mesa ${table.number}) actualizada con éxito`,
      });
    }

    // -------------------------------------------------------------
    // CASE 2: Table is AVAILABLE -> Open Table and Create New Order
    // -------------------------------------------------------------
    // Generate order number
    const count = await prisma.order.count({ where: { brandId } });
    const orderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;

    let subtotal = 0;
    const itemsToCreate = typedItems.map((item) => {
      const p = prodMap.get(item.productId);
      const itemPrice = typeof item.price === 'number' ? item.price : (p?.price || 0);
      subtotal += itemPrice * item.quantity;

      let detectedStage = item.serviceStage;
      if (!detectedStage && p?.category?.name) {
        const catName = p.category.name.toLowerCase();
        if (catName.includes('bebid') || catName.includes('drink') || catName.includes('trago') || catName.includes('refresco')) {
          detectedStage = 'DRINK';
        } else if (catName.includes('entrad') || catName.includes('aperitiv') || catName.includes('starter') || catName.includes('botana')) {
          detectedStage = 'STARTER';
        } else if (catName.includes('postre') || catName.includes('dessert') || catName.includes('dulce') || catName.includes('helado')) {
          detectedStage = 'DESSERT';
        } else {
          detectedStage = 'MAIN';
        }
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
        notes: item.notes || null,
        modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers)) : null,
        status: 'PENDING',
        serviceStage: detectedStage || 'MAIN',
      };
    });

    const tax = Number((subtotal * 0.16).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const newOrder = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber,
          brandId,
          source: 'DINE_IN',
          status: 'PREPARING',
          cookingStartedAt: new Date(),
          customerName: customerName ? customerName.trim() : `Mesa ${table.number}`,
          notes: notes || null,
          subtotal,
          tax,
          tip: 0,
          total,
          tableId: table.id,
          diners: parseInt(String(diners || 1), 10),
          waiterId: effectiveWaiterId,
          currentStage: 'STARTER',
          paymentStatus: 'PENDING',
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          table: true,
          waiter: true,
        },
      });

      // Update table to OCCUPIED
      await tx.table.update({
        where: { id: table.id },
        data: {
          status: 'OCCUPIED',
          assignedWaiterId: effectiveWaiterId,
        },
      });

      return ord;
    });

    // Broadcast SSE to kitchen
    orderEvents.emit('order_created', {
      id: newOrder.id,
      orderNumber: newOrder.orderNumber,
      status: 'PREPARING',
      brandId,
      tableNumber: table.number,
      source: 'WAITER_PAD',
    });

    // Auto print KOT ticket to kitchen printers
    if (itemsToCreate.length > 0) {
      try {
        const autoPrinters = await prisma.printer.findMany({
          where: { brandId, isActive: true },
        });

        if (autoPrinters.length > 0) {
          const brand = await prisma.brand.findUnique({ where: { id: brandId } });
          const processedOrder = {
            ...newOrder,
            brand: brand || undefined,
            items: newOrder.items.map((it: any) => {
              let parsedMods = [];
              if (it.modifiers) {
                try {
                  parsedMods = typeof it.modifiers === 'string' ? JSON.parse(it.modifiers) : it.modifiers;
                } catch {
                  parsedMods = [];
                }
              }
              return { ...it, selectedModifiers: parsedMods };
            }),
          };

          for (const p of autoPrinters) {
            if (p.connectionType === 'VIRTUAL') continue;
            const kot = generateKotBuffer(processedOrder, p);
            if (kot && kot.itemCount > 0) {
              sendToNetworkPrinter(p.ipAddress, p.port, kot.buffer).catch((err) =>
                console.error(`[AutoPrint] Error printing new KOT to ${p.name}:`, err)
              );
            }
          }
        }
      } catch (printErr) {
        console.error('Error auto-printing new KOT to kitchen:', printErr);
      }
    }

    await recordAuditLog({
      brandId,
      userId: session.userId,
      action: 'WAITER_TABLE_OPENED',
      entityType: 'Order',
      entityId: newOrder.id,
      details: {
        tableNumber: table.number,
        orderNumber: newOrder.orderNumber,
        diners: newOrder.diners,
        itemsCount: itemsToCreate.length,
        total,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      action: 'TABLE_OPENED',
      order: newOrder,
      message: `Mesa ${table.number} abierta con comanda #${newOrder.orderNumber}`,
    });
  } catch (error: unknown) {
    console.error('Error creating/updating waiter order:', error);
    return NextResponse.json({ error: 'Error al enviar comanda desde el comandero' }, { status: 500 });
  }
}
