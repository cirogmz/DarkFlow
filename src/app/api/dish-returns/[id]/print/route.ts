import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateDishReturnTicket } from '@/lib/dishReturns';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;

    const returnLog = await prisma.dishReturnLog.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        brand: { select: { name: true } },
        order: { select: { orderNumber: true, table: { select: { number: true } } } },
      },
    });

    if (!returnLog) {
      return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 });
    }

    const ticket = generateDishReturnTicket({
      brandName: returnLog.brand?.name,
      orderNumber: returnLog.order.orderNumber,
      tableNumber: returnLog.tableNumber || returnLog.order.table?.number,
      productName: returnLog.productName,
      quantity: returnLog.quantity,
      price: returnLog.price,
      estimatedFoodCost: returnLog.estimatedFoodCost,
      returnReason: returnLog.returnReason,
      attribution: returnLog.attribution,
      resolution: returnLog.resolution,
      guestCompType: returnLog.guestCompType,
      guestCompAmount: returnLog.guestCompAmount,
      waiterName: returnLog.waiterName,
      supervisorName: returnLog.supervisorName,
      notes: returnLog.notes,
      createdAt: returnLog.createdAt,
    });

    return NextResponse.json({
      success: true,
      ticket,
      productName: returnLog.productName,
    });
  } catch (error: unknown) {
    console.error('Error generating dish return ticket:', error);
    return NextResponse.json({ error: 'Error al generar el vale de devolución' }, { status: 500 });
  }
}
