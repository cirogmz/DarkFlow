import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { confirmOrderPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Body may not be JSON in certain form webhooks
    }

    const { searchParams } = new URL(req.url);
    const providerParam = searchParams.get('provider')?.toUpperCase();

    // 1. Check if Stripe Webhook event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventType = (body as any)?.type;
    if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded' || providerParam === 'STRIPE') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionObj = (body as any)?.data?.object;
      const orderId = sessionObj?.client_reference_id || sessionObj?.metadata?.orderId;
      const paymentId = sessionObj?.id || sessionObj?.payment_intent;

      if (orderId) {
        await confirmOrderPayment({
          orderId,
          gateway: 'STRIPE',
          gatewayPaymentId: paymentId,
          details: sessionObj,
          req,
        });
        return NextResponse.json({ received: true, provider: 'STRIPE', orderId });
      }
    }

    // 2. Check if Mercado Pago Webhook / IPN event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mpAction = (body as any)?.action;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mpType = (body as any)?.type;
    const mpTopic = searchParams.get('topic');
    const mpId = searchParams.get('id') || (body as Record<string, Record<string, string>>)?.data?.id;

    if (mpAction === 'payment.created' || mpAction === 'payment.updated' || mpType === 'payment' || mpTopic === 'payment' || providerParam === 'MERCADOPAGO') {
      if (mpId) {
        // Find existing transaction matching this gateway ID or external reference
        const transaction = await prisma.paymentTransaction.findFirst({
          where: {
            OR: [
              { gatewayPaymentId: String(mpId) },
              { gatewayOrderId: String(mpId) },
            ],
          },
          include: { order: true },
        });

        if (transaction && transaction.orderId) {
          await confirmOrderPayment({
            orderId: transaction.orderId,
            gateway: 'MERCADOPAGO',
            gatewayPaymentId: String(mpId),
            transactionId: transaction.id,
            details: body,
            req,
          });
          return NextResponse.json({ received: true, provider: 'MERCADOPAGO', orderId: transaction.orderId });
        }
      }
    }

    // Generic acknowledgment for webhooks
    return NextResponse.json({ received: true, message: 'Evento recibido y procesado' });
  } catch (error: unknown) {
    console.error('Error in payment webhook handler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar webhook de pago' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    endpoint: '/api/webhooks/payments',
    supportedGateways: ['STRIPE', 'MERCADOPAGO'],
  });
}
