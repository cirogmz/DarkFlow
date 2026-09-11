import { NextRequest, NextResponse } from 'next/server';
import { confirmOrderPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, gateway = 'STRIPE', transactionId, status = 'PAID', cardLast4 = '4242' } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    if (status === 'FAILED') {
      return NextResponse.json({
        success: false,
        error: 'El pago fue declinado por el emisor en modo sandbox',
      });
    }

    const updatedOrder = await confirmOrderPayment({
      orderId,
      gateway,
      gatewayPaymentId: `sim_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      transactionId,
      details: {
        method: gateway,
        simulated: true,
        cardLast4,
        brand: 'Visa / Mastercard',
        authCode: Math.floor(100000 + Math.random() * 900000).toString(),
      },
      req,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Pago de $${updatedOrder.total.toFixed(2)} MXN completado exitosamente con ${gateway}`,
    });
  } catch (error: unknown) {
    console.error('Error in sandbox payment confirmation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al confirmar pago simulado' },
      { status: 500 }
    );
  }
}
