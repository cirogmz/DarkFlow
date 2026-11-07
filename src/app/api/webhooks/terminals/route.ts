import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveTerminalPaymentIntent } from '@/lib/smartTerminals';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'JSON payload inválido' }, { status: 400 });
    }

    // Clip webhook format: { event: 'payment.successful', data: { id, status, amount, ... } }
    // Mercado Pago Point format: { event_type: 'point_payment_intent', data: { id, state: 'FINISHED', ... } }
    const externalIntentId = body?.data?.id || body?.id || body?.payment_intent_id;
    const status = body?.event || body?.data?.status || body?.data?.state || body?.status;

    if (!externalIntentId) {
      return NextResponse.json({ received: true, note: 'Sin intentId' });
    }

    // Find intent in database
    const intent = await prisma.smartTerminalIntent.findFirst({
      where: {
        OR: [
          { providerIntentId: String(externalIntentId) },
          { id: String(externalIntentId) },
        ],
      },
    });

    if (!intent) {
      console.warn(`Webhook terminal: intención ${externalIntentId} no encontrada`);
      return NextResponse.json({ received: true, matched: false });
    }

    const isApproved =
      status === 'payment.successful' ||
      status === 'FINISHED' ||
      status === 'APPROVED' ||
      status === 'approved';

    const isRejected =
      status === 'payment.failed' ||
      status === 'ERROR' ||
      status === 'REJECTED' ||
      status === 'rejected';

    if (isApproved) {
      const cardInfo = body?.data?.payment?.card || body?.data?.card || {};
      await resolveTerminalPaymentIntent({
        intentId: intent.id,
        action: 'APPROVE',
        cardBrand: (cardInfo.brand || 'VISA').toUpperCase(),
        cardLast4: cardInfo.last4 || '4242',
        authCode: body?.data?.receipt?.authorization_code || `AUTH-${Date.now().toString().slice(-6)}`,
        tip: body?.data?.tip || 0,
      });
    } else if (isRejected) {
      await resolveTerminalPaymentIntent({
        intentId: intent.id,
        action: 'REJECT',
        rejectionReason: body?.data?.error_message || 'Transacción rechazada por el banco',
      });
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (error: unknown) {
    console.error('Error in terminal webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en webhook' },
      { status: 500 }
    );
  }
}
