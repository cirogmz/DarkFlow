import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSession } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, gateway, returnUrl } = body;

    if (!orderId || !gateway) {
      return NextResponse.json({ error: 'orderId y gateway (STRIPE | MERCADOPAGO) son requeridos' }, { status: 400 });
    }

    if (gateway !== 'STRIPE' && gateway !== 'MERCADOPAGO') {
      return NextResponse.json({ error: 'Pasarela no soportada. Usar STRIPE o MERCADOPAGO' }, { status: 400 });
    }

    const result = await createPaymentSession({
      orderId,
      gateway,
      returnUrl,
      req,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error creating payment session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar sesión de pago' },
      { status: 500 }
    );
  }
}
