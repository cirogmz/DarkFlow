import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandId = session.activeBrandId;

    // Fetch orders currently in preparation, ready, or received
    const orders = await prisma.order.findMany({
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
              select: {
                id: true,
                name: true,
                targetPrepTime: true,
                kitchenStation: true,
                allergens: true,
                dietaryTags: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const expoOrders = orders.map((order) => {
      const totalItems = order.items.length;
      const doneItems = order.items.filter((i) => i.status === 'DONE').length;
      const servedItems = order.items.filter((i) => i.servedAt !== null).length;
      const checkedItems = order.items.filter((i) => i.expoChecked).length;
      const isComplete = totalItems > 0 && doneItems === totalItems;
      const hasAllergens = order.items.some((i) => Boolean(i.allergenAlert));

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        source: order.source,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        notes: order.notes,
        tableId: order.tableId,
        tableNumber: order.table?.number || null,
        tableName: order.table?.name || null,
        diners: order.diners,
        waiterId: order.waiterId,
        waiterName: order.waiter?.name || null,
        externalOrderId: order.externalOrderId,
        deliveryService: order.deliveryService,
        currentStage: order.currentStage,
        prepTimeTarget: order.prepTimeTarget || 15,
        cookingStartedAt: order.cookingStartedAt,
        cookingFinishedAt: order.cookingFinishedAt,
        expoStatus: order.expoStatus || 'PENDING',
        expoNotifiedAt: order.expoNotifiedAt,
        expoAssembledAt: order.expoAssembledAt,
        expoPackedAt: order.expoPackedAt,
        expoNotes: order.expoNotes,
        deliverySecuritySeal: order.deliverySecuritySeal,
        expoQcPassed: order.expoQcPassed,
        expoQcCheckedAt: order.expoQcCheckedAt,
        expoQcCheckedById: order.expoQcCheckedById,
        expoQcCheckedByName: order.expoQcCheckedByName,
        expoQcNotes: order.expoQcNotes,
        expoTemperature: order.expoTemperature,
        expoHaccpStatus: order.expoHaccpStatus || 'PENDING',
        expoHoldTimeMinutes: order.expoHoldTimeMinutes || 0,
        expoRecookRequested: order.expoRecookRequested,
        expoRecookReason: order.expoRecookReason,
        expoChecklistState: order.expoChecklistState,
        createdAt: order.createdAt,
        totalItems,
        doneItems,
        servedItems,
        checkedItems,
        isComplete,
        hasAllergens,
        items: order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          quantity: i.quantity,
          price: i.price,
          status: i.status,
          serviceStage: i.serviceStage,
          allergenAlert: i.allergenAlert,
          expoChecked: i.expoChecked,
          targetTempMin: i.targetTempMin,
          actualTemp: i.actualTemp,
          tempStatus: i.tempStatus || 'PENDING',
          notes: i.notes,
          modifiers: i.modifiers,
          kitchenStation: i.product.kitchenStation,
          allergens: i.product.allergens,
          dietaryTags: i.product.dietaryTags,
          startedAt: i.startedAt,
          finishedAt: i.finishedAt,
          servedAt: i.servedAt,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      orders: expoOrders,
      metrics: {
        totalActive: expoOrders.length,
        readyToServe: expoOrders.filter((o) => o.isComplete && o.source === 'DINE_IN').length,
        readyToPack: expoOrders.filter((o) => o.isComplete && o.source !== 'DINE_IN' && !o.deliverySecuritySeal).length,
        packedDelivery: expoOrders.filter((o) => Boolean(o.deliverySecuritySeal)).length,
        qcPassedCount: expoOrders.filter((o) => o.expoQcPassed).length,
        haccpPendingCount: expoOrders.filter((o) => o.isComplete && !o.expoQcPassed).length,
        recookRequestedCount: expoOrders.filter((o) => o.expoRecookRequested).length,
      },
    });
  } catch (error) {
    console.error('Error fetching Expo data:', error);
    return NextResponse.json({ error: 'Error al consultar datos de Expo Station' }, { status: 500 });
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
    const { 
      action, 
      orderId, 
      itemId, 
      expoNotes, 
      securitySeal,
      checklist,
      temperature,
      dishType = 'HOT',
      notes,
      reason
    } = body;

    if (!action) {
      return NextResponse.json({ error: 'Falta parámetro action' }, { status: 400 });
    }

    // -------------------------------------------------------------
    // ACTION 1: CHECK_ITEM (Toggle expoChecked on an individual line item)
    // -------------------------------------------------------------
    if (action === 'CHECK_ITEM') {
      if (!itemId) {
        return NextResponse.json({ error: 'Falta itemId' }, { status: 400 });
      }

      const item = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { order: true },
      });

      if (!item || item.order.brandId !== brandId) {
        return NextResponse.json({ error: 'Ítem no encontrado en esta sucursal' }, { status: 404 });
      }

      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: {
          expoChecked: !item.expoChecked,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'CHECK_ITEM',
        itemId: updatedItem.id,
        expoChecked: updatedItem.expoChecked,
      });
    }

    // All order-level actions require orderId
    if (!orderId) {
      return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        waiter: true,
        items: true,
      },
    });

    if (!order || order.brandId !== brandId) {
      return NextResponse.json({ error: 'Comanda no encontrada en esta sucursal' }, { status: 404 });
    }

    // -------------------------------------------------------------
    // ACTION 2: CALL_WAITER (Buzzer call to assigned waiter via SSE)
    // -------------------------------------------------------------
    if (action === 'CALL_WAITER') {
      const now = new Date();
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          expoStatus: 'NOTIFIED_WAITER',
          expoNotifiedAt: now,
          status: 'READY',
        },
        include: {
          table: true,
          waiter: true,
        },
      });

      // Emit SSE event for Waiter Pad & KDS
      orderEvents.emit('order_event', {
        action: 'WAITER_CALLED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'READY',
        brandId: order.brandId,
        source: order.source,
        customerName: order.customerName,
        tableId: order.tableId,
        tableNumber: order.table?.number || null,
        waiterId: order.waiterId,
        waiterName: order.waiter?.name || null,
        timestamp: now.toISOString(),
      });

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'EXPO_WAITER_CALLED',
        entityType: 'Order',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          tableNumber: order.table?.number,
          waiterName: order.waiter?.name,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'CALL_WAITER',
        message: `Llamada enviada a mesero ${order.waiter?.name || ''} para Mesa #${order.table?.number || ''}`,
        order: updatedOrder,
      });
    }

    // -------------------------------------------------------------
    // ACTION 3: SERVE_ALL (Mark all items in table/order as SERVED)
    // -------------------------------------------------------------
    if (action === 'SERVE_ALL') {
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        // Mark all items as DONE and SERVED
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: {
            status: 'DONE',
            servedAt: now,
            expoChecked: true,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            expoStatus: 'SERVED',
            status: 'READY',
          },
        });
      });

      orderEvents.emit('order_event', {
        action: 'STATUS_CHANGED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'READY',
        brandId: order.brandId,
        source: order.source,
        customerName: order.customerName,
        tableId: order.tableId,
        tableNumber: order.table?.number || null,
        timestamp: now.toISOString(),
      });

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'EXPO_ORDER_SERVED',
        entityType: 'Order',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          tableNumber: order.table?.number,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'SERVE_ALL',
        message: `Comanda #${order.orderNumber} (Mesa ${order.table?.number || ''}) servida por completo`,
      });
    }

    // -------------------------------------------------------------
    // ACTION 4: PACK_DELIVERY (Attach security seal and mark READY)
    // -------------------------------------------------------------
    if (action === 'PACK_DELIVERY') {
      const now = new Date();
      // Generate standard security seal folio if not provided
      const finalSeal = securitySeal && typeof securitySeal === 'string' && securitySeal.trim()
        ? securitySeal.trim().toUpperCase()
        : `SEAL-${Math.floor(1000 + Math.random() * 9000)}`;

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Mark all items DONE and checked
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: {
            status: 'DONE',
            expoChecked: true,
          },
        });

        return tx.order.update({
          where: { id: order.id },
          data: {
            status: 'READY',
            expoStatus: 'PACKED',
            expoPackedAt: now,
            deliverySecuritySeal: finalSeal,
            cookingFinishedAt: order.cookingFinishedAt || now,
          },
        });
      });

      orderEvents.emit('order_event', {
        action: 'EXPO_PACKED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'READY',
        brandId: order.brandId,
        source: order.source,
        customerName: order.customerName,
        securitySeal: finalSeal,
        timestamp: now.toISOString(),
      });

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'EXPO_DELIVERY_PACKED',
        entityType: 'Order',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          source: order.source,
          deliveryService: order.deliveryService,
          securitySeal: finalSeal,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'PACK_DELIVERY',
        securitySeal: finalSeal,
        message: `Pedido #${order.orderNumber} empacado con precinto ${finalSeal}`,
        order: updatedOrder,
      });
    }

    // -------------------------------------------------------------
    // ACTION 5: UPDATE_NOTES
    // -------------------------------------------------------------
    if (action === 'UPDATE_NOTES') {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          expoNotes: expoNotes ? String(expoNotes).trim() : null,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'UPDATE_NOTES',
        order: updatedOrder,
      });
    }

    // -------------------------------------------------------------
    // ACTION 6: QC_VERIFY (Expo 5-point checklist & HACCP Temperature check)
    // -------------------------------------------------------------
    if (action === 'QC_VERIFY') {
      const parsedTemp = typeof temperature === 'number' && !isNaN(temperature) ? temperature : null;
      let haccpStatus: 'PASS' | 'FAIL' | 'EXEMPT' = 'EXEMPT';

      if (parsedTemp !== null) {
        if (dishType === 'HOT') {
          // Hot holding critical limit: >= 60°C
          haccpStatus = parsedTemp >= 60 ? 'PASS' : 'FAIL';
        } else if (dishType === 'COLD') {
          // Cold holding critical limit: <= 5°C
          haccpStatus = parsedTemp <= 5 ? 'PASS' : 'FAIL';
        } else {
          haccpStatus = 'PASS';
        }
      }

      // Check checklist state
      const checklistObj = checklist && typeof checklist === 'object' ? checklist : {};
      const checklistValues = Object.values(checklistObj);
      const isChecklistComplete = checklistValues.length > 0 && checklistValues.every((val) => Boolean(val));
      const qcPassed = isChecklistComplete && haccpStatus !== 'FAIL';

      const now = new Date();
      // Calculate hold time in minutes since cookingFinishedAt or order createdAt
      const baseTime = order.cookingFinishedAt || order.createdAt;
      const holdTimeMinutes = Math.max(0, Math.round((now.getTime() - new Date(baseTime).getTime()) / 60000));

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          expoQcPassed: qcPassed,
          expoQcCheckedAt: now,
          expoQcCheckedById: session.userId,
          expoQcCheckedByName: session.name || 'Auditor Pase',
          expoQcNotes: notes ? String(notes).trim() : null,
          expoTemperature: parsedTemp,
          expoHaccpStatus: haccpStatus,
          expoHoldTimeMinutes: holdTimeMinutes,
          expoChecklistState: JSON.stringify(checklistObj),
        },
        include: {
          table: true,
          waiter: true,
        },
      });

      // Emit SSE event
      orderEvents.emit('order_event', {
        action: 'EXPO_QC_VERIFIED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        qcPassed,
        haccpStatus,
        temperature: parsedTemp,
        brandId: order.brandId,
        timestamp: now.toISOString(),
      });

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'EXPO_QC_VERIFIED',
        entityType: 'Order',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          qcPassed,
          haccpStatus,
          temperature: parsedTemp,
          dishType,
          checklist: checklistObj,
          holdTimeMinutes,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'QC_VERIFY',
        qcPassed,
        haccpStatus,
        message: qcPassed
          ? `Control de Calidad y HACCP APROBADO (${parsedTemp !== null ? `${parsedTemp}°C` : 'Sin sonda'})`
          : `Control de Calidad RECHAZADO: ${haccpStatus === 'FAIL' ? 'Temperatura crítica fuera de norma HACCP' : 'Puntos del checklist pendientes'}`,
        order: updatedOrder,
      });
    }

    // -------------------------------------------------------------
    // ACTION 7: RECOOK_ORDER (Send defective/cold dish back to kitchen)
    // -------------------------------------------------------------
    if (action === 'RECOOK_ORDER') {
      const recookReason = reason && typeof reason === 'string' && reason.trim()
        ? reason.trim()
        : 'Rechazado en Pase por Auditoría de Calidad';
      const now = new Date();

      let targetItemName: string | null = null;

      await prisma.$transaction(async (tx) => {
        if (itemId) {
          const itemToRecook = await tx.orderItem.findUnique({
            where: { id: itemId },
            include: { product: true },
          });
          if (itemToRecook) {
            targetItemName = itemToRecook.product.name;
            await tx.orderItem.update({
              where: { id: itemId },
              data: {
                status: 'PENDING',
                finishedAt: null,
                expoChecked: false,
                tempStatus: 'FAIL',
              },
            });
          }
        } else {
          // Reset all items to COOKING
          await tx.orderItem.updateMany({
            where: { orderId: order.id },
            data: {
              status: 'COOKING',
              finishedAt: null,
              expoChecked: false,
              tempStatus: 'FAIL',
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'PREPARING',
            expoStatus: 'RECOOK_REQUESTED',
            expoQcPassed: false,
            expoRecookRequested: true,
            expoRecookReason: recookReason,
          },
        });
      });

      // Emit high-priority urgent alert SSE for Kitchen Display
      orderEvents.emit('order_event', {
        action: 'RECOOK_REQUESTED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        itemId: itemId || null,
        itemName: targetItemName,
        reason: recookReason,
        brandId: order.brandId,
        source: order.source,
        tableNumber: order.table?.number || null,
        timestamp: now.toISOString(),
      });

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'EXPO_RECOOK_REQUESTED',
        entityType: 'Order',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          itemId: itemId || null,
          itemName: targetItemName,
          reason: recookReason,
          tableNumber: order.table?.number,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'RECOOK_ORDER',
        message: `Comanda #${order.orderNumber} enviada a REHACER en cocina: ${recookReason}`,
      });
    }

    // -------------------------------------------------------------
    // ACTION 8: TEMP_AUDIT (HACCP digital probe recording)
    // -------------------------------------------------------------
    if (action === 'TEMP_AUDIT') {
      const parsedTemp = typeof temperature === 'number' && !isNaN(temperature) ? temperature : null;
      if (parsedTemp === null) {
        return NextResponse.json({ error: 'Falta valor de temperatura válido' }, { status: 400 });
      }

      let haccpStatus: 'PASS' | 'FAIL' = 'PASS';
      if (dishType === 'HOT') {
        haccpStatus = parsedTemp >= 60 ? 'PASS' : 'FAIL';
      } else if (dishType === 'COLD') {
        haccpStatus = parsedTemp <= 5 ? 'PASS' : 'FAIL';
      }

      if (itemId) {
        await prisma.orderItem.update({
          where: { id: itemId },
          data: {
            actualTemp: parsedTemp,
            tempStatus: haccpStatus,
          },
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          expoTemperature: parsedTemp,
          expoHaccpStatus: haccpStatus,
        },
      });

      await recordAuditLog({
        brandId,
        userId: session.userId,
        action: 'EXPO_TEMP_AUDITED',
        entityType: 'Order',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          temperature: parsedTemp,
          dishType,
          haccpStatus,
          itemId: itemId || null,
        },
        req,
      });

      return NextResponse.json({
        success: true,
        action: 'TEMP_AUDIT',
        temperature: parsedTemp,
        haccpStatus,
        order: updatedOrder,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error processing Expo action:', error);
    return NextResponse.json({ error: 'Error al procesar acción en Expo Station' }, { status: 500 });
  }
}
