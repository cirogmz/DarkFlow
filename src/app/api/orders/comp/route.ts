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
    const { searchParams } = new URL(req.url);
    const compType = searchParams.get('compType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search')?.trim().toLowerCase();

    const where: any = {
      brandId,
      isComped: true,
    };

    if (compType && compType !== 'ALL') {
      where.compType = compType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        table: true,
        waiter: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filtered = orders.filter((o) => {
      if (!search) return true;
      const oNum = o.orderNumber.toLowerCase();
      const ben = (o.compBeneficiaryName || '').toLowerCase();
      const sup = (o.compApprovedByName || '').toLowerCase();
      const reason = (o.compReason || '').toLowerCase();
      return oNum.includes(search) || ben.includes(search) || sup.includes(search) || reason.includes(search);
    });

    let totalRetailComped = 0;
    let totalFoodCostAbsorbed = 0;
    const typeBreakdown: Record<string, { count: number; retail: number; cost: number }> = {
      STAFF_MEAL: { count: 0, retail: 0, cost: 0 },
      VIP_COURTESY: { count: 0, retail: 0, cost: 0 },
      TASTING_SAMPLE: { count: 0, retail: 0, cost: 0 },
      SERVICE_RECOVERY: { count: 0, retail: 0, cost: 0 },
      OTHER: { count: 0, retail: 0, cost: 0 },
    };

    const supervisorMap: Record<string, { name: string; count: number; totalRetail: number; totalCost: number }> = {};

    for (const o of filtered) {
      const retailVal = o.total || o.subtotal || 0;
      const foodCostVal = o.compFoodCost || 0;

      totalRetailComped += retailVal;
      totalFoodCostAbsorbed += foodCostVal;

      const tKey = o.compType && typeBreakdown[o.compType] ? o.compType : 'OTHER';
      typeBreakdown[tKey].count++;
      typeBreakdown[tKey].retail += retailVal;
      typeBreakdown[tKey].cost += foodCostVal;

      const supName = o.compApprovedByName || 'Administrador';
      if (!supervisorMap[supName]) {
        supervisorMap[supName] = { name: supName, count: 0, totalRetail: 0, totalCost: 0 };
      }
      supervisorMap[supName].count++;
      supervisorMap[supName].totalRetail += retailVal;
      supervisorMap[supName].totalCost += foodCostVal;
    }

    return NextResponse.json({
      success: true,
      orders: filtered,
      stats: {
        totalOrders: filtered.length,
        totalRetailComped: Math.round(totalRetailComped * 100) / 100,
        totalFoodCostAbsorbed: Math.round(totalFoodCostAbsorbed * 100) / 100,
        typeBreakdown,
        supervisors: Object.values(supervisorMap).sort((a, b) => b.totalRetail - a.totalRetail),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching comp orders:', error);
    return NextResponse.json({ error: 'Error al consultar historial de cortesías' }, { status: 500 });
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
      orderId,
      compType = 'STAFF_MEAL',
      compReason,
      compBeneficiaryName,
      pinCode,
    } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    if (!pinCode || String(pinCode).trim().length < 4) {
      return NextResponse.json({ error: 'PIN de autorización gerencial requerido (mínimo 4 dígitos)' }, { status: 400 });
    }

    // 1. PIN Verification against authorized supervisors/admins in this brand
    const cleanPin = String(pinCode).trim();
    const supervisor = await prisma.user.findFirst({
      where: {
        pinCode: cleanPin,
        role: { in: ['SUPER_ADMIN', 'BRAND_ADMIN', 'CASHIER'] },
        OR: [
          { role: 'SUPER_ADMIN' },
          { brands: { some: { brandId } } },
        ],
      },
    });

    if (!supervisor) {
      return NextResponse.json({
        error: 'PIN de autorización inválido o el usuario no cuenta con privilegios de supervisor para autorizar cortesías',
      }, { status: 403 });
    }

    // 2. Fetch order with its items & recipe items to calculate real food cost absorption
    const order = await prisma.order.findFirst({
      where: { id: orderId, brandId },
      include: {
        table: true,
        items: {
          include: {
            product: {
              include: {
                recipeItems: {
                  include: {
                    ingredient: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 });
    }

    if (order.isComped) {
      return NextResponse.json({ error: 'Esta comanda ya ha sido registrada previamente como cortesía' }, { status: 400 });
    }

    // 3. Compute real theoretical food cost from recipes
    let calculatedFoodCost = 0;
    for (const item of order.items) {
      const prod = item.product;
      if (prod.recipeItems && prod.recipeItems.length > 0) {
        for (const recipeItem of prod.recipeItems) {
          const ingCost = recipeItem.ingredient.cost || 0;
          calculatedFoodCost += (recipeItem.quantity * item.quantity * ingCost);
        }
      } else {
        // Fallback estimate if no recipe defined: ~30% standard food cost
        calculatedFoodCost += (item.price * item.quantity * 0.30);
      }
    }

    calculatedFoodCost = Math.round(calculatedFoodCost * 100) / 100;
    const now = new Date();

    // 4. Atomic transaction to comp the order and close it out
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order
      const res = await tx.order.update({
        where: { id: order.id },
        data: {
          isComped: true,
          compType,
          compReason: compReason?.trim() || 'Autorizado por Gerencia',
          compBeneficiaryName: compBeneficiaryName?.trim() || supervisor.name,
          compApprovedById: supervisor.id,
          compApprovedByName: supervisor.name,
          compApprovedAt: now,
          compFoodCost: calculatedFoodCost,
          paymentStatus: 'PAID',
          paymentMethod: 'COURTESY',
          discountAmount: order.total,
          paidAmount: 0,
          paidAt: now,
        },
        include: {
          table: true,
          waiter: true,
          items: true,
        },
      });

      // Update OrderItems
      await tx.orderItem.updateMany({
        where: { orderId: order.id },
        data: {
          isComped: true,
          compType,
        },
      });

      // If associated with a table, free the table
      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return res;
    });

    // 5. Audit Log (WARNING severity for forensic loss-prevention visibility)
    await recordAuditLog({
      action: 'ORDER_COMPED',
      entityType: 'ORDER',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        tableNumber: order.table?.number,
        compType,
        compReason: compReason || 'Autorizado',
        compBeneficiaryName,
        approvedBy: supervisor.name,
        retailValueSaved: order.total,
        foodCostAbsorbed: calculatedFoodCost,
      },
      severity: 'WARNING',
      brandId,
      userId: supervisor.id,
      req,
    });

    // 6. Emit real-time update
    orderEvents.emit('order_event', {
      action: 'STATUS_CHANGED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'PAID',
      brandId,
      source: order.source,
      tableNumber: order.table?.number,
      timestamp: now.toISOString(),
      order: updatedOrder,
    });

    return NextResponse.json({
      success: true,
      message: `Comanda #${order.orderNumber} autorizada como ${compType} por ${supervisor.name}`,
      order: updatedOrder,
      supervisor: supervisor.name,
      compFoodCost: calculatedFoodCost,
      retailValue: order.total,
    });
  } catch (error: unknown) {
    console.error('Error applying comp to order:', error);
    return NextResponse.json({ error: 'Error al autorizar cortesía / comida de personal' }, { status: 500 });
  }
}
