import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: any = {
      brandId: session.activeBrandId,
    };

    if (driverId) {
      where.driverId = driverId;
    }
    if (status) {
      where.status = status;
    }

    const settlements = await prisma.driverSettlement.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            deliveryProfile: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            paymentMethod: true,
            total: true,
            tip: true,
            deliveryFee: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: { settledAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, settlements });
  } catch (error: unknown) {
    console.error('Error fetching driver settlements:', error);
    return NextResponse.json({ error: 'Error al consultar liquidaciones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      driverId,
      totalCashTurnedIn,
      cashFloatReturned = 0,
      notes = '',
      orderIds,
      deductTips = false,
      deductCommissions = false,
    } = body;

    if (!driverId) {
      return NextResponse.json({ error: 'Falta driverId' }, { status: 400 });
    }

    const cashTurnedIn = typeof totalCashTurnedIn === 'number' ? totalCashTurnedIn : parseFloat(totalCashTurnedIn || '0');

    // 1. Fetch driver
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      include: { deliveryProfile: true },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 });
    }

    // 2. Fetch target orders to settle
    const orderQueryWhere: any = {
      brandId: session.activeBrandId,
      driverId,
      status: 'DELIVERED',
      driverSettled: false,
    };

    if (Array.isArray(orderIds) && orderIds.length > 0) {
      orderQueryWhere.id = { in: orderIds };
    }

    const ordersToSettle = await prisma.order.findMany({
      where: orderQueryWhere,
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    if (ordersToSettle.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron pedidos entregados pendientes de liquidar para este repartidor' },
        { status: 400 }
      );
    }

    // 3. Compute totals
    const isCashPayment = (method?: string | null) => {
      if (!method) return true;
      const m = method.toUpperCase();
      return m.includes('CASH') || m.includes('EFECTIVO');
    };

    let totalCashExpected = 0;
    let totalTips = 0;
    let totalDeliveryFees = 0;

    for (const ord of ordersToSettle) {
      if (isCashPayment(ord.paymentMethod)) {
        totalCashExpected += ord.total;
      }
      totalTips += (ord.tip || 0);
      totalDeliveryFees += (ord.deliveryFee || 0);
    }

    const commissionRate = driver.deliveryProfile?.commissionPerOrder || 0;
    const totalCommissions = commissionRate * ordersToSettle.length;

    let netCashToCashier = totalCashExpected + (cashFloatReturned || 0);
    if (deductTips) {
      netCashToCashier -= totalTips;
    }
    if (deductCommissions) {
      netCashToCashier -= totalCommissions;
    }

    const cashDifference = cashTurnedIn - netCashToCashier;

    // 4. Find open cash session if exists
    const openCashSession = await prisma.cashSession.findFirst({
      where: {
        brandId: session.activeBrandId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });

    // 5. Generate settlement number
    const count = await prisma.driverSettlement.count({
      where: { brandId: session.activeBrandId },
    });
    const settlementNumber = `LIQ-${String(count + 1).padStart(4, '0')}`;

    // 6. Execute atomic transaction
    const settlement = await prisma.$transaction(async (tx) => {
      // Create DriverSettlement
      const newSettlement = await tx.driverSettlement.create({
        data: {
          settlementNumber,
          brandId: session.activeBrandId!,
          driverId,
          cashierId: session.userId,
          cashSessionId: openCashSession?.id,
          totalOrders: ordersToSettle.length,
          totalCashExpected,
          totalCashTurnedIn: cashTurnedIn,
          cashDifference,
          totalTips,
          totalCommissions,
          cashFloatReturned: cashFloatReturned || 0,
          netCashToCashier,
          status: 'SETTLED',
          notes: notes || undefined,
          settledAt: new Date(),
        },
      });

      // Update orders
      for (const ord of ordersToSettle) {
        const orderUpdate: any = {
          driverSettlementId: newSettlement.id,
          driverSettled: true,
        };

        // If it was cash and unpaid, mark paid
        if (ord.paymentStatus !== 'PAID' && isCashPayment(ord.paymentMethod)) {
          orderUpdate.paymentStatus = 'PAID';
          orderUpdate.paidAt = new Date();
          orderUpdate.paidAmount = ord.total;
        }

        await tx.order.update({
          where: { id: ord.id },
          data: orderUpdate,
        });
      }

      // If active cash session exists and cash turned in > 0, register cash movement
      if (openCashSession && cashTurnedIn > 0) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: openCashSession.id,
            type: 'IN',
            amount: cashTurnedIn,
            category: 'COD_DELIVERY_SETTLEMENT',
            reason: `Liquidación Repartidor ${settlementNumber} - ${driver.name}`,
            createdById: session.userId,
            createdByName: session.name,
          },
        });

        await tx.cashSession.update({
          where: { id: openCashSession.id },
          data: {
            cashInTotal: { increment: cashTurnedIn },
          },
        });
      }

      // Check if driver has any other active deliveries
      const otherActive = await tx.order.count({
        where: {
          driverId,
          status: 'ON_THE_WAY',
        },
      });

      if (otherActive === 0) {
        await tx.deliveryProfile.updateMany({
          where: { userId: driverId },
          data: { status: 'AVAILABLE' },
        });
      }

      return newSettlement;
    });

    // Record audit log
    await recordAuditLog({
      brandId: session.activeBrandId,
      userId: session.userId,
      action: 'DRIVER_SETTLEMENT_CREATED',
      entityType: 'DriverSettlement',
      entityId: settlement.id,
      details: {
        settlementNumber,
        driverId,
        driverName: driver.name,
        totalOrders: ordersToSettle.length,
        totalCashExpected,
        totalCashTurnedIn: cashTurnedIn,
        cashDifference,
        notes,
      },
      req,
    });

    // Fetch full settlement for response
    const fullSettlement = await prisma.driverSettlement.findUnique({
      where: { id: settlement.id },
      include: {
        brand: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            deliveryProfile: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        orders: {
          include: {
            items: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      settlement: fullSettlement,
      message: `Liquidación #${settlementNumber} completada con éxito`,
    });
  } catch (error: unknown) {
    console.error('Error creating driver settlement:', error);
    return NextResponse.json({ error: 'Error al procesar liquidación de repartidor' }, { status: 500 });
  }
}
